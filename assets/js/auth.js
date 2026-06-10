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

    async signUp(email, password, nickname, userType, manufacturerType) {
        // userType: 'manufacturer'|'business'|'personal'
        // manufacturerType: 'factory'|'personal'|undefined
        var res = await getSupabase().auth.signUp({
            email, password,
            options: { data: { nickname, user_type: userType } }
        });
        if (res.error) throw res.error;
        if (res.data.user) {
            var profileData = { id: res.data.user.id, email, nickname, user_type: userType };
            if (manufacturerType) profileData.manufacturer_type = manufacturerType;
            await getSupabase().from('profiles').upsert(profileData);
        }
        return res.data;
    },

    async signIn(email, password) {
        // 로컬 스토리지 세션 먼저 클리어 (깨진 세션 방지)
        localStorage.removeItem('gf-auth-v1');
        var res = await getSupabase().auth.signInWithPassword({ email, password });
        if (res.error) throw res.error;
        return res.data;
    },

    async signOut() {
        try {
            localStorage.removeItem('gf-auth-v1');
            await getSupabase().auth.signOut();
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
