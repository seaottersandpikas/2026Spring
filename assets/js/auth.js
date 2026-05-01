function getSupabase() {
    if (!window.supabaseClient) throw new Error('Supabase 미초기화');
    return window.supabaseClient;
}

var Auth = {
    async getUser() {
        try {
            var res = await getSupabase().auth.getUser();
            return res.data.user || null;
        } catch(e) { return null; }
    },

    async getProfile() {
        try {
            var user = await this.getUser();
            if (!user) return null;
            var res = await getSupabase()
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            return res.data || null;
        } catch(e) { return null; }
    },

    async signUp(email, password, nickname, userType) {
        var res = await getSupabase().auth.signUp({
            email, password,
            options: { data: { nickname, user_type: userType } }
        });
        if (res.error) throw res.error;
        if (res.data.user) {
            await getSupabase().from('profiles').upsert({
                id: res.data.user.id,
                email, nickname, user_type: userType
            });
        }
        return res.data;
    },

    async signIn(email, password) {
        // 기존 세션 완전히 정리 후 로그인
        try { await getSupabase().auth.signOut({ scope: 'local' }); } catch(e) {}
        var res = await getSupabase().auth.signInWithPassword({ email, password });
        if (res.error) throw res.error;
        return res.data;
    },

    async signOut() {
        try {
            await getSupabase().auth.signOut({ scope: 'local' });
        } catch(e) {
            console.warn('signOut 경고 (무시):', e.message);
        }
    },

    onAuthStateChange(callback) {
        return getSupabase().auth.onAuthStateChange(callback);
    }
};

window.Auth = Auth;
console.log('✅ Auth 로드 완료');
