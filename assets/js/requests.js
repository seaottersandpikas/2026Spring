var Requests = {
    async create(requestData) {
        const user = await Auth.getUser();
        if (!user) throw new Error('로그인이 필요합니다.');
        const { data, error } = await window.supabaseClient.from('requests')
            .insert([{ ...requestData, user_id: user.id }]).select().single();
        if (error) throw error;
        return data;
    },
    async getMyRequests() {
        const user = await Auth.getUser();
        if (!user) return [];
        const { data, error } = await window.supabaseClient.from('requests')
            .select('*, bids(*)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        if (error) { console.error(error); return []; }
        return data || [];
    },
    async getById(requestId) {
        const { data, error } = await window.supabaseClient.from('requests')
            .select('*, bids(*), request_files(*)').eq('id', requestId).single();
        if (error) return null;
        return data;
    },
    async update(requestId, updateData) {
        const { data, error } = await window.supabaseClient.from('requests')
            .update({ ...updateData, updated_at: new Date().toISOString() })
            .eq('id', requestId).select().single();
        if (error) throw error;
        return data;
    },
    async cancel(requestId) {
        return this.update(requestId, { status: 'cancelled' });
    },
    async selectBid(requestId, bidId, manufacturerName, unitPrice) {
        await window.supabaseClient.from('bids').update({ status: 'selected' }).eq('id', bidId);
        await window.supabaseClient.from('bids').update({ status: 'rejected' }).eq('request_id', requestId).neq('id', bidId);
        const req = await this.update(requestId, { status: 'matched' });
        await window.supabaseClient.from('match_history').insert([{
            request_id: requestId, bid_id: bidId, category: req.category,
            title: req.title, quantity: req.quantity, target_price: req.target_price,
            matched_price: unitPrice, request_type: req.request_type
        }]);
        return req;
    },
    async getMatchHistory(requestType, limit) {
        let query = window.supabaseClient.from('match_history').select('*')
            .order('matched_at', { ascending: false }).limit(limit || 20);
        if (requestType) query = query.eq('request_type', requestType);
        const { data, error } = await query;
        if (error) return [];
        return data || [];
    }
};
window.Requests = Requests;
