function getSupabase() {
    if (!window.supabaseClient) throw new Error('Supabase가 초기화되지 않았습니다.');
    return window.supabaseClient;
}

var Auth = {
    async getUser() {
        try {
            var res = await getSupabase().auth.getUser();
            return res.data.user;
        } catch(e) { return null; }
    },
    async getProfile() {
        var user = await this.getUser();
        if (!user) return null;
        var res = await getSupabase().from('profiles').select('*').eq('id', user.id).single();
        return res.data || null;
    },
    async signUp(email, password, nickname, userType) {
        var res = await getSupabase().auth.signUp({
            email: email, password: password,
            options: { data: { nickname: nickname, user_type: userType } }
        });
        if (res.error) throw res.error;
        if (res.data.user) {
            await getSupabase().from('profiles').upsert({
                id: res.data.user.id, email: email,
                nickname: nickname, user_type: userType
            });
        }
        return res.data;
    },
    async signIn(email, password) {
        var res = await getSupabase().auth.signInWithPassword({ email: email, password: password });
        if (res.error) throw res.error;
        return res.data;
    },
    async signOut() {
        var res = await getSupabase().auth.signOut();
        if (res.error) throw res.error;
    },
    onAuthStateChange(callback) {
        return getSupabase().auth.onAuthStateChange(callback);
    }
};

window.Auth = Auth;
