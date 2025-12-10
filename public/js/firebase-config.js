// Firebase configuration
// IMPORTANT: Replace these values with your Firebase project credentials
// Get them from: https://console.firebase.google.com/ > Project Settings > General > Your apps

const firebaseConfig = {
    apiKey: "AIzaSyBrLsvuMY1StcG0rftQ91Vbm_WoadqSjtQ",
    authDomain: "logintrigger.firebaseapp.com",
    projectId: "logintrigger",
    storageBucket: "logintrigger.firebasestorage.app",
    messagingSenderId: "458163856416",
    appId: "1:458163856416:web:d204ff2a1fa012eb708845",
    measurementId: "G-24C10WWFL8"
};

// Initialize Firebase
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
} else {
    console.warn('Firebase SDK not loaded yet');
}
