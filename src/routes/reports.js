const express = require('express');
const router = express.Router();
const db = require('../database');
const { getUserId } = require('../authMiddleware');

// Get general stats
router.get('/stats', (req, res) => {
    try {
        const userId = getUserId(req);
        const stats = db.getStats(userId);
        res.json({ success: true, stats });
    } catch (err) {
        console.error('Error getting stats:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get all campaigns with summary
router.get('/campaigns', (req, res) => {
    try {
        const userId = getUserId(req);
        const campaigns = db.getAllCampaigns(userId);

        const campaignsWithStats = campaigns.map(campaign => {
            const total = campaign.total_contacts || 0;
            const sent = campaign.sent_count || 0;
            const failed = campaign.failed_count || 0;

            // Calculate success rate based on sent messages
            const successRate = total > 0
                ? Math.round((sent / total) * 100)
                : 0;

            return {
                ...campaign,
                sent_count: sent,
                failed_count: failed,
                successRate
            };
        });

        res.json({ success: true, campaigns: campaignsWithStats });
    } catch (err) {
        console.error('Error getting campaigns:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get campaign details with logs
router.get('/campaigns/:id', (req, res) => {
    try {
        const campaign = db.getCampaignById(req.params.id);

        if (!campaign) {
            return res.status(404).json({ success: false, error: 'Campaign not found' });
        }

        const logs = db.getLogsByCampaign(req.params.id);

        const summary = {
            total: logs.length,
            sent: logs.filter(l => l.status === 'sent').length,
            failed: logs.filter(l => l.status === 'failed').length,
            pending: logs.filter(l => l.status === 'pending').length
        };

        res.json({
            success: true,
            campaign,
            logs,
            summary
        });
    } catch (err) {
        console.error('Error getting campaign details:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get daily stats (last 30 days)
router.get('/daily', (req, res) => {
    try {
        const dailyStats = db.all(`
            SELECT 
                date(created_at) as date,
                COUNT(*) as campaigns,
                SUM(sent_count) as sent,
                SUM(failed_count) as failed
            FROM campaigns
            WHERE created_at >= date('now', '-30 days')
            GROUP BY date(created_at)
            ORDER BY date DESC
        `);

        res.json({ success: true, dailyStats });
    } catch (err) {
        console.error('Error getting daily stats:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Export report as CSV
router.get('/export/:campaignId', (req, res) => {
    try {
        const campaign = db.getCampaignById(req.params.campaignId);
        const logs = db.getLogsByCampaign(req.params.campaignId);

        if (!campaign) {
            return res.status(404).json({ success: false, error: 'Campaign not found' });
        }

        // Generate CSV
        let csv = 'Nome,Telefone,Status,Mensagem,Erro,Data de Envio\n';

        logs.forEach(log => {
            csv += `"${log.contact_name || ''}","${log.contact_phone || ''}","${log.status}","${(log.message_content || '').replace(/"/g, '""')}","${log.error_message || ''}","${log.sent_at || ''}"\n`;
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=campaign_${campaign.id}_report.csv`);
        res.send(csv);
    } catch (err) {
        console.error('Error exporting campaign:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
