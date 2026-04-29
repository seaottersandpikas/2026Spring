function getSupabase() {
    if (!window.supabaseClient) throw new Error('Supabase가 초기화되지 않았습니다.');
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
        } catch(e) {
            console.error('getProfile 오류:', e);
            return null;
        }
    },

    async signUp(email, password, nickname, userType) {
        var res = await getSupabase().auth.signUp({
            email: email,
            password: password,
            options: { data: { nickname: nickname, user_type: userType } }
        });
        if (res.error) throw res.error;
        if (res.data.user) {
            await getSupabase().from('profiles').upsert({
                id: res.data.user.id,
                email: email,
                nickname: nickname,
                user_type: userType
            });
        }
        return res.data;
    },

    async signIn(email, password) {
        var res = await getSupabase().auth.signInWithPassword({
            email: email,
            password: password
        });
        if (res.error) throw res.error;
        return res.data;
    },

    async signOut() {
        var res = await getSupabase().auth.signOut({ scope: 'local' });
        if (res.error) throw res.error;
    },

    onAuthStateChange(callback) {
        return getSupabase().auth.onAuthStateChange(callback);
    }
};

window.Auth = Auth;
console.log('✅ Auth 모듈 로드 완료');
