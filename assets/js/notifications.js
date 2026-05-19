var Notifications = {

    async create(userId, type, title, message, relatedId) {
        if (!userId) return;
        var res = await window.supabaseClient.from('notifications').insert([{
            user_id:    userId,
            type:       type,
            title:      title,
            message:    message || '',
            related_id: relatedId || null
        }]);
        if (res.error) console.warn('알림 생성 실패:', res.error.message);
    },

    async getMyNotifications() {
        var user = await Auth.getUser();
        if (!user) return [];
        var res = await window.supabaseClient
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(30);
        if (res.error) { console.error(res.error); return []; }
        return res.data || [];
    },

    async getUnreadCount() {
        var user = await Auth.getUser();
        if (!user) return 0;
        var res = await window.supabaseClient
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('is_read', false);
        if (res.error) return 0;
        return res.count || 0;
    },

    async markAllRead() {
        var user = await Auth.getUser();
        if (!user) return;
        await window.supabaseClient
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', user.id)
            .eq('is_read', false);
    }
};

window.Notifications = Notifications;
console.log('✅ Notifications 모듈 로드 완료');
