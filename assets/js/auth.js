// =====================================================
// 인증(로그인/회원가입) 관련 함수들
// =====================================================

function getSupabase() {
    if (!window.supabaseClient) {
        throw new Error('Supabase가 초기화되지 않았습니다. 잠시 후 다시 시도해주세요.');
    }
    return window.supabaseClient;
}

const Auth = {

    async getUser() {
        const sb = getSupabase();
        const { data: { user } } = await sb.auth.getUser();
        return user;
    },

    async getProfile() {
        const sb = getSupabase();
        const user = await this.getUser();
        if (!user) return null;

        const { data, error } = await sb
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error) {
            console.error('프로필 조회 오류:', error);
            return null;
        }
        return data;
    },

    async signUp(email, password, nickname, userType) {
        const sb = getSupabase();

        const { data, error } = await sb.auth.signUp({
            email,
            password,
            options: {
                data: { nickname, user_type: userType }
            }
        });
        if (error) throw error;

        if (data.user) {
            await sb.from('profiles').upsert({
                id: data.user.id,
                email,
                nickname,
                user_type: userType
            });
        }
        return data;
    },

    async signIn(email, password) {
        const sb = getSupabase();
        const { data, error } = await sb.auth.signInWithPassword({
            email,
            password
        });
        if (error) throw error;
        return data;
    },

    async signOut() {
        const sb = getSupabase();
        const { error } = await sb.auth.signOut();
        if (error) throw error;
    },

    onAuthStateChange(callback) {
        const sb = getSupabase();
        return sb.auth.onAuthStateChange(callback);
    }
};

window.Auth = Auth;
console.log('✅ Auth 모듈 로드 완료');