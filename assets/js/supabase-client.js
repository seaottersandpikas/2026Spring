// Supabase 클라이언트 - 딱 한 번만 생성
(function () {
    // 이미 생성된 경우 중복 실행 방지
    if (window.supabaseClient) {
        console.log('⚠️ Supabase 이미 초기화됨 - 중복 실행 방지');
        return;
    }

    var SUPABASE_URL     = 'https://gdfhomgmwthtttnkgoko.supabase.co';
    var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkZmhvbWdtd3RodHR0bmtnb2tvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5MTkyODMsImV4cCI6MjA5MjQ5NTI4M30.hrpMBj3Ev3r78imzFn7T2I4_9RFEV7NJKHNbec_cT_Y';

    function init() {
        if (typeof window.supabase === 'undefined') {
            console.error('❌ Supabase CDN 로드 실패');
            return;
        }
        window.supabaseClient = window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_ANON_KEY,
            {
                auth: {
                    storageKey: 'gf-auth-token',
                    autoRefreshToken: true,
                    persistSession: true,
                    detectSessionInUrl: false
                }
            }
        );
        console.log('✅ Supabase 연결 완료');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
