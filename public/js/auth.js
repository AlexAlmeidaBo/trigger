// Authentication module
const Auth = {
    currentUser: null,

    // Initialize auth state listener
    init() {
        return new Promise((resolve) => {
            // Check for existing token
            const token = localStorage.getItem('authToken');
            const userData = localStorage.getItem('userData');

            if (token && userData) {
                this.currentUser = JSON.parse(userData);
                resolve(this.currentUser);
            } else {
                resolve(null);
            }

            // Listen for Firebase auth state changes
            if (typeof firebase !== 'undefined' && firebase.auth) {
                firebase.auth().onAuthStateChanged(async (user) => {
                    if (user) {
                        const token = await user.getIdToken();
                        this.currentUser = {
                            uid: user.uid,
                            email: user.email,
                            displayName: user.displayName,
                            photoURL: user.photoURL
                        };
                        localStorage.setItem('authToken', token);
                        localStorage.setItem('userData', JSON.stringify(this.currentUser));
                    }
                });
            }
        });
    },

    // Login with Google
    async loginWithGoogle() {
        if (typeof firebase === 'undefined' || !firebase.auth) {
            throw new Error('Firebase não está configurado. Verifique firebase-config.js');
        }

        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({
            prompt: 'select_account'
        });

        try {
            const result = await firebase.auth().signInWithPopup(provider);
            const user = result.user;
            const token = await user.getIdToken();

            this.currentUser = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL
            };

            localStorage.setItem('authToken', token);
            localStorage.setItem('userData', JSON.stringify(this.currentUser));

            // Register user in backend
            await this.registerUser(token);

            return this.currentUser;
        } catch (error) {
            console.error('Google login error:', error);
            if (error.code === 'auth/popup-closed-by-user') {
                throw new Error('Login cancelado');
            }
            if (error.code === 'auth/network-request-failed') {
                throw new Error('Erro de conexão. Verifique sua internet.');
            }
            throw error;
        }
    },

    // Create user with email and password
    async createUserWithEmail(email, password) {
        if (typeof firebase === 'undefined' || !firebase.auth) {
            throw new Error('Firebase não está configurado. Verifique firebase-config.js');
        }

        try {
            const result = await firebase.auth().createUserWithEmailAndPassword(email, password);
            const user = result.user;
            const token = await user.getIdToken();

            this.currentUser = {
                uid: user.uid,
                email: user.email,
                displayName: user.email.split('@')[0],
                photoURL: null
            };

            localStorage.setItem('authToken', token);
            localStorage.setItem('userData', JSON.stringify(this.currentUser));

            // Register user in backend
            await this.registerUser(token);

            return this.currentUser;
        } catch (error) {
            console.error('Email registration error:', error);
            if (error.code === 'auth/email-already-in-use') {
                throw new Error('Este email já está cadastrado. Tente fazer login.');
            }
            if (error.code === 'auth/invalid-email') {
                throw new Error('Email inválido.');
            }
            if (error.code === 'auth/weak-password') {
                throw new Error('A senha deve ter no mínimo 6 caracteres.');
            }
            throw new Error('Erro ao criar conta. Tente novamente.');
        }
    },

    // Login with email and password
    async loginWithEmail(email, password) {
        if (typeof firebase === 'undefined' || !firebase.auth) {
            throw new Error('Firebase não está configurado. Verifique firebase-config.js');
        }

        try {
            const result = await firebase.auth().signInWithEmailAndPassword(email, password);
            const user = result.user;
            const token = await user.getIdToken();

            this.currentUser = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || user.email.split('@')[0],
                photoURL: user.photoURL
            };

            localStorage.setItem('authToken', token);
            localStorage.setItem('userData', JSON.stringify(this.currentUser));

            return this.currentUser;
        } catch (error) {
            console.error('Email login error:', error);
            if (error.code === 'auth/user-not-found') {
                throw new Error('Usuário não encontrado. Verifique o email ou crie uma conta.');
            }
            if (error.code === 'auth/wrong-password') {
                throw new Error('Senha incorreta.');
            }
            if (error.code === 'auth/invalid-email') {
                throw new Error('Email inválido.');
            }
            if (error.code === 'auth/too-many-requests') {
                throw new Error('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
            }
            throw new Error('Erro ao fazer login. Tente novamente.');
        }
    },

    // Register user in backend
    async registerUser(token) {
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                console.warn('Failed to register user in backend');
            }
        } catch (error) {
            console.warn('Backend registration error:', error);
        }
    },

    // Logout
    async logout() {
        try {
            if (typeof firebase !== 'undefined' && firebase.auth) {
                await firebase.auth().signOut();
            }
        } catch (error) {
            console.error('Firebase logout error:', error);
        }

        this.currentUser = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        window.location.href = '/login.html';
    },

    // Get auth token for API requests
    getToken() {
        return localStorage.getItem('authToken');
    },

    // Check if user is logged in
    isLoggedIn() {
        return !!this.getToken();
    },

    // Get current user
    getUser() {
        if (this.currentUser) return this.currentUser;

        const userData = localStorage.getItem('userData');
        if (userData) {
            this.currentUser = JSON.parse(userData);
            return this.currentUser;
        }
        return null;
    },

    // Refresh token
    async refreshToken() {
        if (typeof firebase !== 'undefined' && firebase.auth) {
            const user = firebase.auth().currentUser;
            if (user) {
                const token = await user.getIdToken(true);
                localStorage.setItem('authToken', token);
                return token;
            }
        }
        return null;
    },

    // Make authenticated API request
    async fetchWithAuth(url, options = {}) {
        const token = this.getToken();

        if (!token) {
            window.location.href = '/login.html';
            throw new Error('Not authenticated');
        }

        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        };

        const response = await fetch(url, { ...options, headers });

        // If unauthorized, try to refresh token or redirect to login
        if (response.status === 401) {
            const newToken = await this.refreshToken();
            if (newToken) {
                headers['Authorization'] = `Bearer ${newToken}`;
                return fetch(url, { ...options, headers });
            } else {
                this.logout();
                throw new Error('Session expired');
            }
        }

        return response;
    }
};

// Export for use in other modules
window.Auth = Auth;
