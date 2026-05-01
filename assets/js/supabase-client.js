(function () {
    if (window._sbInitialized) return;
    window._sbInitialized = true;

    var SUPABASE_URL      = 'https://gdfhomgmwthtttnkgoko.supabase.co';
    var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkZmhvbWdtd3RodHR0bmtnb2tvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5MTkyODMsImV4cCI6MjA5MjQ5NTI4M30.hrpMBj3Ev3r78imzFn7T2I4_9RFEV7NJKHNbec_cT_Y';

    window.supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        {
            auth: {
                storageKey:         'gf-auth-v1',
                autoRefreshToken:   true,
                persistSession:     true,
                detectSessionInUrl: false,
                flowType:           'implicit'
            }
        }
    );
    console.log('✅ Supabase 초기화 완료');
})();
