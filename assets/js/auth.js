function getSupabase() {
    if (!window.supabaseClient) {
        throw new Error('Supabase가 초기화되지 않았습니다.');
    }
    return window.supabaseClient;
}

var Auth = {
    async getUser() {
        const { data: { user } } = await getSupabase().auth.getUser();
        return user;
    },
    async getProfile() {
        const user = await this.getUser();
        if (!user) return null;
        const { data } = await getSupabase().from('profiles').select('*').eq('id', user.id).single();
        return data;
    },
    async signUp(email, password, nickname, userType) {
        const { data, error } = await getSupabase().auth.signUp({
            email, password, options: { data: { nickname, user_type: userType } }
        });
        if (error) throw error;
        if (data.user) {
            await getSupabase().from('profiles').upsert({ id: data.user.id, email, nickname, user_type: userType });
        }
        return data;
    },
    async signIn(email, password) {
        const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
    },
    async signOut() {
        const { error } = await getSupabase().auth.signOut();
        if (error) throw error;
    },
    onAuthStateChange(callback) {
        return getSupabase().auth.onAuthStateChange(callback);
    }
};
window.Auth = Auth;
