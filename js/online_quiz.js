(function() {
    // === 상수 정의 ===
    const GAME_DATA_URL = 'https://hook.us2.make.com/qqpwtdvb7fyvs6ig7fpsmey77maq3hwe';
    const LOGIN_WEBHOOK_URL = 'https://hook.us2.make.com/l4c2x95zil7cfga2eom1crq3qpknrpk2'; 
    const UPLOAD_WEBHOOK_URL = 'https://hook.us2.make.com/ndkqaabtqnm1t4e5gqg3shqojufowyog';
    const SIGNUP_WEBHOOK_URL = 'https://hook.us2.make.com/ln2bggsxzoi7y8vtddhyjiz5e59yphxa';
    const CIRCLE_NUMBERS = ['①', '②', '③', '④', '⑤']; // 5선지까지 확장

    // === DB 및 상태 저장소 ===
    let DB = {
        Questions: []
    };

    let currentUser = {
        id: null,
        name: null,
        qRange: '',
        qCount: 0,
        history: [], // {QsetID, QuestionID, TimesAppeared, TimesCorrect}
        dailyCounts: [],
        quizLog: []
    };

    let currentQuizQuestions = []; // 현재 퀴즈의 파싱된 문제 객체 배열
    let userAnswers = []; // 사용자가 선택한 답 (선지 index) 배열
    let currentQuestionIndex = 0; // 현재 풀고 있는 문제 index
    let currentReviewIndex = 0; // 현재 다시보는 문제 index
    let currentCategoryTitle = ''; // 현재 퀴즈 제목

    // === DOM 요소 캐시 ===
    const screens = {
        loading: document.getElementById('loading-screen'),
        login: document.getElementById('login-screen'),
        signup: document.getElementById('signup-screen'),
        lobby: document.getElementById('quiz-lobby-screen'),
        quiz: document.getElementById('quiz-screen'),
        results: document.getElementById('results-screen'),
    };
    const loadingMessage = document.getElementById('loading-message'); // (신규)

    // 로그인 화면 DOM 요소
    const loginIdInput = document.getElementById('login-id-input');
    const loginPwInput = document.getElementById('login-pw-input');
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    const loginErrorMessage = document.getElementById('login-error-message');

    // 회원가입 화면 DOM 요소
    const signupIdInput = document.getElementById('signup-id-input');
    const signupPwInput = document.getElementById('signup-pw-input');
    const signupPwConfirmInput = document.getElementById('signup-pw-confirm-input');
    const signupNameInput = document.getElementById('signup-name-input');
    const signupSubmitBtn = document.getElementById('signup-submit-btn');
    const signupBackBtn = document.getElementById('signup-back-btn');
    const signupErrorMessage = document.getElementById('signup-error-message');
    
    // (수정) 퀴즈 로비(구 시작) 화면 DOM 요소
    const lobbyWelcomeMessage = document.getElementById('lobby-welcome-message');
    const lobbyQuizInfo = document.getElementById('lobby-quiz-info');
    const lobbyQCount = document.getElementById('lobby-q-count');
    const lobbyStartBtn = document.getElementById('lobby-start-btn');
    
    // (수정) 시작 화면 DOM 요소
    const qRangeInput = document.getElementById('q-range-input');
    const qCountInput = document.getElementById('q-count-input');
    const startQuizBtn = document.getElementById('start-quiz-btn');
    
    const quizTitle = document.getElementById('quiz-title');
    const questionNumber = document.getElementById('question-number');
    const questionContent = document.getElementById('question-content');
    const choicesContainer = document.getElementById('choices-container');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const submitBtn = document.getElementById('submit-btn');

    // (수정) 채점 화면 DOM 요소
    const resultsScore = document.getElementById('results-score'); // (신규)
    const resultsListModal = document.getElementById('results-list-modal'); // (신규)
    const resultsListModalContent = document.getElementById('results-list-modal-content'); // (신규)
    const openResultsModalBtn = document.getElementById('open-results-modal-btn'); // (신규)
    const closeResultsModalBtn = document.getElementById('close-results-modal-btn'); // (신규)
    // const resultsList = document.getElementById('results-list'); // (삭제) 더 이상 static 요소가 아님

    const reviewTitle = document.getElementById('review-title');
    const reviewQuestionNumber = document.getElementById('review-question-number');
    const reviewQuestionContent = document.getElementById('review-question-content');
    const reviewChoicesContainer = document.getElementById('review-choices-container');
    const reviewExplanation = document.getElementById('review-explanation');
    const prevResultBtn = document.getElementById('prev-result-btn');
    const nextResultBtn = document.getElementById('next-result-btn');
    const backToStartBtn = document.getElementById('back-to-start-btn');

    // === 헬퍼 함수 ===

    /**
     * (신규) common.js에서 가져온 DB 파싱 함수
     */
    function parseDB(rawData, headers) {
        if (!rawData) return [];
        try {
            return rawData.map(s => JSON.parse(s)).map(rawObj => {
                const newObj = {};
                headers.forEach((header, index) => { newObj[header] = rawObj[index]; });
                return newObj;
            });
        } catch (error) {
            console.error("DB 파싱 중 오류 발생:", error, rawData);
            return [];
        }
    }

    /**
     * (신규) clinic_maker.js에서 가져온 Q-Set 범위 파싱 함수
     */
    function parseQuestionPool(poolString) {
        if (!poolString) return [];
        const ids = new Set();
        const parts = poolString.split(',');
        let prefix = '';
        let padLength = 0;

        for (const part of parts) {
            const trimmedPart = part.trim();
            if (trimmedPart.includes('~')) {
                const [startStr, endStr] = trimmedPart.split('~');
                const matchStart = startStr.match(/([a-zA-Z]*)(\d+)/);
                const matchEnd = endStr.match(/([a-zA-Z]*)(\d+)/);

                if (matchStart && matchEnd && matchStart[1] === matchEnd[1]) {
                    prefix = matchStart[1];
                    padLength = matchStart[2].length;
                    const startNum = parseInt(matchStart[2], 10);
                    const endNum = parseInt(matchEnd[2], 10);

                    if (!isNaN(startNum) && !isNaN(endNum) && startNum <= endNum) {
                        for (let i = startNum; i <= endNum; i++) {
                            ids.add(prefix + String(i).padStart(padLength, '0'));
                        }
                    }
                }
            } else {
                const matchSingle = trimmedPart.match(/([a-zA-Z]*)(\d+)/);
                if (matchSingle) {
                    ids.add(trimmedPart);
                }
            }
        }
        return Array.from(ids);
    }

    /**
     * clinic_maker.js에서 가져온 문제 파싱 함수
     */
    function parseQuestion(questionString, questionType) {
        const parts = questionString.split('⊥');
        const questionData = { type: questionType };

        if (questionType === '1') {
            questionData.prompt = parts[0] || '';
            questionData.context = parts[1] || '';
            let isFixedOrder = (parts[2] && parts[2].startsWith('#'));
            questionData.isFixedOrder = isFixedOrder;
            questionData.choices = [
                parts[2] ? parts[2].replace('#', '') : '',
                parts[3] || '', 
                parts[4] || '', 
                parts[5] || ''
            ].filter(c => c); // 빈 선지는 제외
            
            const correctIndex = parseInt(parts[6], 10) - 1;
            questionData.correctAnswerText = questionData.choices[correctIndex] || questionData.choices[0];
            questionData.explanation = parts[7] || '';
        } else if (questionType === '2') {
            questionData.prompt = parts[0] || '';
            questionData.context = parts[1] || '';
            questionData.correctAnswerText = parts[2] || '';
            questionData.explanation = parts[3] || '';
            questionData.choices = []; 
        }
        return questionData;
    }

    /**
     * 배열 섞기 (Fisher-Yates Shuffle)
     */
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /**
     * 화면 전환 함수
     */
    function showScreen(screenName) {
        Object.keys(screens).forEach(key => {
            screens[key].classList.add('hidden');
        });
        if (screens[screenName]) {
            screens[screenName].classList.remove('hidden');
        }
    }

    function getKSTDateString() {
        const dtf = new Intl.DateTimeFormat('ko-KR', {
            timeZone: 'Asia/Seoul',
            year: '2-digit',
            month: '2-digit',
            day: '2-digit'
        });
        // "25. 11. 05." 형식을 "25.11.05"로 변경
        return dtf.format(new Date()).replace(/\. /g, '.').replace(/\.$/, '');
    }

    function getKSTTimestampString() {
        // 'sv-SE' 로캘은 'YYYY-MM-DD HH:MM:SS' 형식의 문자열을 반환
        return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' });
    }

    /**
     * DB에서 문제 텍스트를 HTML로 변환
     */
    function formatTextToHtml(text) {
        if (!text) return '';
        return text
            .replace(/@(.*?)@/g, '<u>$1</u>') // 밑줄
            .replace(/▽/g, '<br>'); // 줄바꿈
    }

    // 로그인 화면 초기화
    function initializeLoginScreen() {
        loginBtn.onclick = handleLogin;
        // 비밀번호 입력 후 Enter 키로 로그인
        loginPwInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                handleLogin();
            }
        });

        signupBtn.onclick = () => {
            // 입력 필드와 에러 메시지 초기화
            signupIdInput.value = '';
            signupPwInput.value = '';
            signupPwConfirmInput.value = '';
            signupNameInput.value = '';
            signupErrorMessage.classList.add('hidden');
            showScreen('signup');
        };

        signupBtn.disabled = false; // 임시
    }

    // 로그인 시도
    async function handleLogin() {
        const id = loginIdInput.value.trim();
        const pass = loginPwInput.value.trim();
        if (!id || !pass) {
            loginErrorMessage.textContent = '아이디와 비밀번호를 모두 입력하세요.';
            loginErrorMessage.classList.remove('hidden');
            return;
        }

        loginErrorMessage.classList.add('hidden');
        loadingMessage.textContent = '로그인 중...';
        showScreen('loading');

        try {
            // (수정) 변수명 변경 (이것은 JSON 텍스트임)
            const responseText = await fetchUserData(id, pass); 
            if (responseText) {
                
                // (신규) 서버가 보낸 JSON 텍스트를 1차 파싱
                const responseJson = JSON.parse(responseText);
                
                // (신규) JSON 객체에서 실제 'userData' 문자열 추출
                const userDataString = responseJson.userData; 

                if (!userDataString) {
                    throw new Error("Webhook 응답에 'userData' 필드가 없습니다.");
                }

                // (수정) 추출한 순수 ⊥ 문자열을 파서에 전달
                parseUserData(userDataString, id);
                
                // (2) 사용자 정보 로드 성공 후, 문항 DB 로드
                loadingMessage.textContent = '문제 DB를 불러오는 중입니다...';
                await loadQuestionData(); // await로 변경
                
                // (3) 문항 DB 로드 성공 후, 로비 화면 초기화
                initializeLobbyScreen();
                showScreen('lobby');

            } else {
                throw new Error('사용자 정보를 찾을 수 없습니다.');
            }
        } catch (error) {
            console.error('로그인 프로세스 오류:', error);
            loginErrorMessage.textContent = error.message || '로그인에 실패했습니다.';
            loginErrorMessage.classList.remove('hidden');
            showScreen('login');
        }
    }

    // (신규) 사용자 DB (웹훅) 호출
    async function fetchUserData(id, pass) {
        const response = await fetch(LOGIN_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id, pass: pass })
        });

        if (!response.ok) {
            throw new Error(`서버 응답 오류 (${response.status})`);
        }
        
        const dataString = await response.text(); 
        
        if (!dataString || dataString.length < 10 || !dataString.includes('⊥')) {
            console.error("웹훅에서 유효한 사용자 데이터를 받지 못했습니다.", dataString);
            throw new Error('아이디 또는 비밀번호가 일치하지 않습니다.');
        }

        return dataString;
    }

    function parseUserData(dataString, userId) {
        console.log("--- PARSE START ---");
        console.log("Raw ⊥ string:", dataString);
        try {
            const parts = dataString.split('⊥');
            currentUser.id = userId;
            currentUser.name = parts[2] || '사용자';
            currentUser.qRange = parts[3] || 'Q001~Q003'; // 기본값
            currentUser.qCount = parseInt(parts[4], 10) || 10; // 기본값

            // (수정) .trim()을 사용하여 모든 문자열의 앞뒤 공백을 안전하게 제거
            const historyString = (parts[6] || "").trim();
            const dailyCountsString = (parts[7] || "").trim();
            const quizLogString = (parts[8] || "").trim(); // (신규)

            console.log("Received history string [parts[6]]:", historyString);
            console.log("Received dailyCounts string [parts[7]]:", dailyCountsString);
            console.log("Received quizLog string [parts[8]]:", quizLogString); // (신규)

            // (수정) 더 안전한 파싱 로직: { 로 시작하든 [ 로 시작하든 처리
            if (historyString.startsWith('{')) {
                currentUser.history = JSON.parse(`[${historyString}]`); // {..} -> [{..}]
            } else if (historyString.startsWith('[')) {
                currentUser.history = JSON.parse(historyString); // [{..}] -> [{..}]
            } else {
                currentUser.history = []; // "", "null" 등
            }

            // (수정) 더 안전한 파싱 로직
            if (dailyCountsString.startsWith('{')) {
                currentUser.dailyCounts = JSON.parse(`[${dailyCountsString}]`);
            } else if (dailyCountsString.startsWith('[')) {
                currentUser.dailyCounts = JSON.parse(dailyCountsString);
            } else {
                currentUser.dailyCounts = [];
            }
            
            // (신규) quizLog 파싱 로직 추가
            if (quizLogString.startsWith('{')) {
                currentUser.quizLog = JSON.parse(`[${quizLogString}]`);
            } else if (quizLogString.startsWith('[')) {
                currentUser.quizLog = JSON.parse(quizLogString);
            } else {
                currentUser.quizLog = [];
            }
            
            console.log("Parsed currentUser.history:", JSON.parse(JSON.stringify(currentUser.history)));
            console.log("Parsed currentUser.dailyCounts:", JSON.parse(JSON.stringify(currentUser.dailyCounts)));
            console.log("Parsed currentUser.quizLog:", JSON.parse(JSON.stringify(currentUser.quizLog))); // (신규)
            console.log("--- PARSE SUCCESS ---");

        } catch (error) {
            // (수정) catch 블록에서도 모든 데이터를 안전하게 초기화
            currentUser.history = [];
            currentUser.dailyCounts = [];
            currentUser.quizLog = []; // (신규)
            console.error("!!! PARSE FAILED. Resetting history. !!!");
            console.error("Error details:", error, "Raw string was:", dataString);
            console.log("--- PARSE FAILED ---");
            throw new Error('사용자 데이터를 파싱하는 중 오류가 발생했습니다.');
        }
    }

    // 회원가입 화면 초기화
    function initializeSignupScreen() {
        signupSubmitBtn.onclick = handleSignupRequest;
        signupBackBtn.onclick = () => {
            // 에러 메시지 숨기고 로그인 화면으로
            loginErrorMessage.classList.add('hidden');
            showScreen('login');
        };
    }

    // 회원가입 시도
    async function handleSignupRequest() {
        const id = signupIdInput.value.trim();
        const pass = signupPwInput.value.trim();
        const passConfirm = signupPwConfirmInput.value.trim();
        const name = signupNameInput.value.trim();

        // 1. 프론트엔드 유효성 검사
        if (!id || !pass || !passConfirm || !name) {
            signupErrorMessage.textContent = '모든 항목을 입력해주세요.';
            signupErrorMessage.classList.remove('hidden');
            return;
        }
        if (pass !== passConfirm) {
            signupErrorMessage.textContent = '비밀번호가 일치하지 않습니다.';
            signupErrorMessage.classList.remove('hidden');
            return;
        }

        signupErrorMessage.classList.add('hidden');
        loadingMessage.textContent = '회원가입 요청 중...';
        showScreen('loading');

        try {
            // 2. 서버(웹훅)로 회원가입 요청
            const response = await fetch(SIGNUP_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    id: id, 
                    pass: pass, 
                    name: name 
                })
            });

            if (!response.ok) {
                // 서버가 4xx, 5xx 에러를 반환한 경우
                throw new Error(`서버 응답 오류 (${response.status})`);
            }

            const result = await response.json();

            // 3. 웹훅 응답 처리
            // (서버는 {"status":"success"} 또는 {"status":"error", "message":"..."} 를 반환한다고 가정)
            if (result.status === 'success') {
                alert('회원가입이 완료되었습니다!\n로그인 화면으로 이동합니다.');
                loginIdInput.value = id; // 편의를 위해 ID 자동 입력
                loginPwInput.value = ''; // 비밀번호 필드 초기화
                showScreen('login');
            } else {
                // (예: ID 중복)
                throw new Error(result.message || '알 수 없는 오류가 발생했습니다.');
            }

        } catch (error) {
            console.error('회원가입 프로세스 오류:', error);
            signupErrorMessage.textContent = error.message;
            signupErrorMessage.classList.remove('hidden');
            showScreen('signup'); // 회원가입 화면으로 복귀
        }
    }

    // 로비 화면 초기화
    function initializeLobbyScreen() {
        lobbyWelcomeMessage.textContent = `${currentUser.name}님, 환영합니다!`;
        lobbyQuizInfo.textContent = `오늘의 퀴즈가 준비되었습니다.`;
        lobbyQCount.textContent = `${currentUser.qCount} 문항`;
        lobbyStartBtn.onclick = startQuiz;
    }

    // === 퀴즈 핵심 로직 ===

    /**
     * DB 로드
     */
    async function loadQuestionData() {
        try {
            const response = await fetch(GAME_DATA_URL);
            if (!response.ok) throw new Error(`서버 응답 오류: ${response.status}`);
            const data = await response.json();

            DB.Questions = parseDB(data.Questions, ['id', 'name', 'type', 'question1', 'question2', 'question3', 'question4', 'question5', 'question6', 'question7', 'question8', 'question9', 'question10', 'question11', 'question12', 'question13', 'question14', 'question15', 'question16', 'question17', 'question18', 'question19', 'question20']);
            
            console.log("DB Loaded:", DB.Questions.length, "sets");
            
            // (수정) DB 로드 성공 (로그인 핸들러가 후속 처리)
            // 여기서 화면 전환 안 함.

        } catch (error) {
            console.error('Question DB 로딩 중 오류 발생:', error);
            // (수정) 로딩 실패 시 로그인 화면으로 복귀
            loginErrorMessage.textContent = '문제 DB 로딩에 실패했습니다. 다시 로그인해주세요.';
            loginErrorMessage.classList.remove('hidden');
            showScreen('login');
            throw error; // 에러를 상위 (handleLogin)로 전파
        }
    }

    /**
     * (수정) 시작 화면에 이벤트 리스너 연결
     */
    function initializeStartScreen() {
        startQuizBtn.onclick = startQuiz;
        // 로컬스토리지에서 이전 값 불러오기 (선택사항)
        qRangeInput.value = localStorage.getItem('quiz_qRange') || '';
        qCountInput.value = localStorage.getItem('quiz_qCount') || '10';
    }

    /**
     * (수정) 퀴즈 시작 (입력값 기반)
     */
    function startQuiz() {
        const range = currentUser.qRange;
        const count = currentUser.qCount;

        if (!range || !count || count <= 0) {
            alert("퀴즈 설정이 올바르지 않습니다. (관리자 문의)");
            return;
        }

        // 1. 범위 내 모든 Set ID 찾기
        const setIds = parseQuestionPool(range);
        if (setIds.length === 0) {
            alert("유효한 Q-Set ID를 찾을 수 없습니다. (예: Q001~Q003, Q006)");
            return;
        }

        console.log(`Finding questions in ${setIds.length} sets for range: ${range}`);

        // 2. 모든 Set을 순회하며 가능한 모든 문제 좌표 수집 (객관식만)
        let allAvailableCoords = [];
        for (const setId of setIds) {
            const qSet = DB.Questions.find(q => q.id === setId);
            if (!qSet) {
                console.warn(`Set ID ${setId} not found in DB.`);
                continue;
            }

            // 1~20번 문제까지 순회하며 유효한 문제(좌표) 수집
            for (let i = 1; i <= 20; i++) {
                const qString = qSet['question' + i];
                if (qString && qString.includes('⊥')) { // 유효한 문제인지 간단히 확인
                    allAvailableCoords.push({ 
                        setId: qSet.id, 
                        qIndex: i,
                        qSetType: qSet.type,
                        qString: qString
                    });
                }
            }
        }

        console.log(`Found ${allAvailableCoords.length} total available questions.`);

        // 3. 문제 수가 충분한지 확인
        if (allAvailableCoords.length < count) {
            alert(`오류: 생성 가능한 문항 수가 요청한 문항 수보다 적습니다.\n\n- 요청 문항 수: ${count}개\n- (범위 내) 생성 가능 문항 수: ${allAvailableCoords.length}개\n\nQ-Set 범위나 문항 수를 조절해주세요.`);
            return;
        }

        // 4. 전체 풀에서 랜덤으로 N개 선택
        shuffleArray(allAvailableCoords);
        const finalCoords = allAvailableCoords.slice(0, count);

        // 5. 퀴즈 데이터 구성
        currentQuizQuestions = [];
        userAnswers = [];
        currentQuestionIndex = 0;

        finalCoords.forEach(coord => {
            const qData = parseQuestion(coord.qString, coord.qSetType);

            qData.sourceSetId = coord.setId;
            qData.sourceQIndex = coord.qIndex;

            if (qData.type === '1') {
                // (기존) 객관식 로직
                const originalChoices = [...qData.choices];
                let finalChoices = [];
                let correctIndexInFinal = -1;

                if (qData.isFixedOrder) {
                    finalChoices = originalChoices;
                } else {
                    finalChoices = shuffleArray([...originalChoices]);
                }
                
                correctIndexInFinal = finalChoices.findIndex(choice => choice === qData.correctAnswerText);
                
                qData.finalChoices = finalChoices; // 섞인 선지
                qData.correctChoiceIndex = correctIndexInFinal; // 섞인 선지 기준 정답 index
                
                userAnswers.push(-1); // -1: 아직 선택 안함
            } else if (qData.type === '2') {
                // (신규) 주관식 로직
                // 선지 섞기 필요 없음
                qData.finalChoices = [];
                qData.correctChoiceIndex = -1; // 사용 안 함
                
                userAnswers.push(""); // "": 아직 선택 안함 (주관식)
            }
            
            currentQuizQuestions.push(qData);

        });

        if (currentQuizQuestions.length === 0) {
            alert("문제를 불러오는 데 실패했습니다.");
            return;
        }

        quizTitle.textContent = `${currentUser.name}(${currentUser.qCount} 문항)`;
        showScreen('quiz');
        renderCurrentQuestion();
    }


    /**
     * 현재 문제 화면 렌더링
     */
    function renderCurrentQuestion() {
        const qData = currentQuizQuestions[currentQuestionIndex];
        if (!qData) return;

        // 1. 문제 번호
        questionNumber.textContent = `${currentQuestionIndex + 1} / ${currentQuizQuestions.length}`;

        // 2. 문제 내용 (지문, <보기> 등)
        let contentHtml = `<p class="text-xl font-medium mb-4">${formatTextToHtml(qData.prompt)}</p>`;
        if (qData.context) {
            contentHtml += `<div class="context">${formatTextToHtml(qData.context)}</div>`;
        }
        questionContent.innerHTML = contentHtml;

        // 3. 선지 (또는 입력창)
        choicesContainer.innerHTML = '';

        if (qData.type === '1') {
            // (기존) 객관식: 선지 버튼 생성
            qData.finalChoices.forEach((choice, index) => {
                const button = document.createElement('button');
                button.className = "choice-btn w-full text-left py-3 px-4 bg-white font-medium rounded-lg shadow border border-gray-200 hover:bg-gray-50 transition";
                button.innerHTML = `<b>${CIRCLE_NUMBERS[index]}</b> ${formatTextToHtml(choice)}`;
                button.dataset.choiceIndex = index;
                
                if (userAnswers[currentQuestionIndex] === index) {
                    button.classList.add('selected');
                }

                button.onclick = () => handleChoiceSelect(index);
                choicesContainer.appendChild(button);
            });
        } else if (qData.type === '2') {
            // (신규) 주관식: 텍스트 입력창 생성
            const inputWrapper = document.createElement('div');
            inputWrapper.className = "relative";
            
            const input = document.createElement('input');
            input.type = "text";
            input.className = "w-full px-5 py-4 border-2 border-gray-300 rounded-xl shadow-sm text-lg font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition";
            input.placeholder = "여기에 답안을 입력하세요...";
            
            // 이전에 입력한 답이 있으면 채워넣기
            input.value = userAnswers[currentQuestionIndex] || "";

            // 입력할 때마다 userAnswers 배열에 실시간으로 저장
            input.oninput = () => {
                userAnswers[currentQuestionIndex] = input.value;
            };
            
            inputWrapper.appendChild(input);
            choicesContainer.appendChild(inputWrapper);
        }

        // 4. 네비게이션 버튼 상태 업데이트
        prevBtn.disabled = (currentQuestionIndex === 0);
        nextBtn.disabled = (currentQuestionIndex === currentQuizQuestions.length - 1);
        
        submitBtn.classList.toggle('hidden', currentQuestionIndex !== currentQuizQuestions.length - 1);
        nextBtn.classList.toggle('hidden', currentQuestionIndex === currentQuizQuestions.length - 1);
    }

    /**
     * 선지 선택 처리
     */
    function handleChoiceSelect(selectedIndex) {
        userAnswers[currentQuestionIndex] = selectedIndex;

        // 모든 버튼에서 'selected' 클래스 제거
        choicesContainer.querySelectorAll('.choice-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        // 클릭한 버튼에 'selected' 클래스 추가
        const selectedBtn = choicesContainer.querySelector(`[data-choice-index="${selectedIndex}"]`);
        if (selectedBtn) {
            selectedBtn.classList.add('selected');
        }
    }

    /**
     * '다음' 버튼 클릭
     */
    function handleNext() {
        if (currentQuestionIndex < currentQuizQuestions.length - 1) {
            currentQuestionIndex++;
            renderCurrentQuestion();
        }
    }

    /**
     * '이전' 버튼 클릭
     */
    function handlePrev() {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            renderCurrentQuestion();
        }
    }

    /**
     * '제출' 버튼 클릭 (채점)
     */
    function handleSubmit() {
        const unanwsered = userAnswers.findIndex(answer => answer === -1 || answer === "");
        if (unanwsered !== -1) {
             if (!confirm(`아직 풀지 않은 문제가 있습니다. (${unanwsered + 1}번)\n그래도 제출하시겠습니까?`)) {
                currentQuestionIndex = unanwsered;
                renderCurrentQuestion();
                return;
             }
        }
        
        console.log("Submitting:", userAnswers);

        let correctCount = 0;

        // --- 퀴즈 로그 개선 (수정 1) ---
        // 퀴즈 세션의 타임스탬프를 한 번만 생성합니다.
        const sessionTime = getKSTTimestampString();
        // --- 퀴즈 로그 개선 (수정 1 끝) ---

        currentQuizQuestions.forEach((qData, index) => {
            let isCorrect = false;
            if (qData.type === '1') {
                isCorrect = (userAnswers[index] === qData.correctChoiceIndex);
            } else if (qData.type === '2') {
                const userAnswerText = (userAnswers[index] || "").trim();
                isCorrect = (userAnswerText === qData.correctAnswerText);
            }
            
            // 1. 개별 문항 히스토리 업데이트
            updateSolveHistory(qData.sourceSetId, qData.sourceQIndex, isCorrect);
            
            if (isCorrect) {
                correctCount++;
            }

            // --- 퀴즈 로그 개선 (수정 2) ---
            // (신규) 2. 퀴즈 로그 생성 및 추가 (개별 문항 단위로)
            // 기존의 세션 단위 로그를 대체합니다.
            const newQuizLogEntry = {
                time: sessionTime,                     // (필수) 세션 시간
                QsetID: qData.sourceSetId,             // (필수) 문제의 Q-set ID
                QuestionID: qData.sourceQIndex,        // (권장) 문제 번호
                correct: isCorrect                     // (필수) 정답 여부
            };
            currentUser.quizLog.push(newQuizLogEntry);
            // --- 퀴즈 로그 개선 (수정 2 끝) ---
        });
        const totalQuestions = currentQuizQuestions.length;
        const score = (totalQuestions > 0) ? Math.round((correctCount / totalQuestions) * 100) : 0;

        // --- 퀴즈 로그 개선 (수정 3) ---
        // (삭제) 2. 퀴즈 로그 생성 및 추가 (세션 단위)
        // const newQuizLogEntry = { ... };
        // currentUser.quizLog.push(newQuizLogEntry);
        console.log("Quiz log updated (detailed):", currentUser.quizLog); // (수정) 로그 메시지
        // --- 퀴즈 로그 개선 (수정 3 끝) ---

        // 3. 일자별 풀이 횟수 업데이트
        updateDailyCount();
        
        // 4. 모든 갱신된 데이터를 서버로 업로드
        uploadUserData(); 

        showScreen('results');
        renderResults(score, correctCount);
    }

    function renderResults(score, correctCount) {
        // 1. 점수 계산 및 표시
        const totalQuestions = currentQuizQuestions.length;
        
        resultsScore.innerHTML = `
            <div class="text-5xl font-black mb-2">${score}<span class="text-3xl">점</span></div>
            <div class="text-base font-medium text-gray-600">총 ${totalQuestions}문제 중 ${correctCount}개 정답</div>
        `;
        // 점수에 따라 그라데이션 색상 클래스 적용
        resultsScore.className = `score-display text-center leading-tight ${score >= 80 ? 'score-high' : (score >= 50 ? 'score-mid' : 'score-low')}`;



        // (수정) 2. 모달 내부에 목록 생성
        resultsListModalContent.innerHTML = ''; // 모달 내용 초기화
        const listEl = document.createElement('div');
        listEl.id = 'results-list';
        listEl.className = 'space-y-2'; // (수정) 세로 정렬

        currentQuizQuestions.forEach((qData, index) => {
            const userAnswerIndex = userAnswers[index];
            const isCorrect = (userAnswerIndex === qData.correctChoiceIndex);

            const item = document.createElement('button');
            // (수정) 세로 목록에 맞는 스타일
            item.className = `result-item flex justify-between items-center w-full py-3 px-4 rounded-md font-medium border ${isCorrect ? 'correct border-green-300 bg-green-50' : 'incorrect border-red-300 bg-red-50'} hover:opacity-80 transition`;
            // (수정) 세로 목록에 맞는 내용
            item.innerHTML = `
                <span class="text-lg">${String(index + 1).padStart(2, '0')}번</span> 
                <span class="font-bold text-lg">${isCorrect ? 'O' : 'X'}</span>
            `;
            item.dataset.resultIndex = index;
            
            // (수정) 클릭 시 모달 닫고 해당 문제로 점프
            item.onclick = () => {
                resultsListModal.classList.add('hidden');
                jumpToReview(index);
            };
            
            listEl.appendChild(item);
        });
        resultsListModalContent.appendChild(listEl); // 모달에 리스트 추가

        // 3. 첫 번째 문제 리뷰 화면 표시
        jumpToReview(0);
    }

    /**
     * 특정 번호의 문제 리뷰 화면으로 점프
     */
    function jumpToReview(index) {
        currentReviewIndex = index;
        const qData = currentQuizQuestions[currentReviewIndex];
        const userAnswer = userAnswers[currentReviewIndex]; // (수정) 인덱스가 아닐 수 있음
        
        let isCorrect = false;
        if (qData.type === '1') {
            isCorrect = (userAnswer === qData.correctChoiceIndex);
        } else if (qData.type === '2') {
            const userAnswerText = (userAnswer || "").trim();
            isCorrect = (userAnswerText === qData.correctAnswerText);
        }

        reviewTitle.textContent = isCorrect 
            ? `${index + 1}번 (정답 O)` 
            : `${index + 1}번 (오답 X)`;
        reviewTitle.className = `text-xl font-semibold ${isCorrect ? 'text-green-600' : 'text-red-600'}`;
        
        reviewQuestionNumber.textContent = `${currentReviewIndex + 1} / ${currentQuizQuestions.length}`;

        let contentHtml = `<p class="text-xl font-medium mb-4">${formatTextToHtml(qData.prompt)}</p>`;
        if (qData.context) {
            contentHtml += `<div class="context">${formatTextToHtml(qData.context)}</div>`;
        }
        reviewQuestionContent.innerHTML = contentHtml;

        reviewChoicesContainer.innerHTML = '';

        if (qData.type === '1') {
            // (기존) 객관식: 선지 버튼 표시
            const userAnswerIndex = userAnswer; // type 1일 땐 userAnswer가 index임
            qData.finalChoices.forEach((choice, i) => {
                const button = document.createElement('button');
                button.className = "choice-btn w-full text-left py-3 px-4 font-medium rounded-lg shadow border";
                button.innerHTML = `<b>${CIRCLE_NUMBERS[i]}</b> ${formatTextToHtml(choice)}`;
                button.disabled = true; 

                if (i === qData.correctChoiceIndex) {
                    button.classList.add('correct');
                } 
                else if (i === userAnswerIndex) {
                    button.classList.add('incorrect');
                }
                else {
                     button.classList.add('bg-white', 'border-gray-200', 'opacity-70');
                }
                
                reviewChoicesContainer.appendChild(button);
            });
        } else if (qData.type === '2') {
            // (신규) 주관식: "내 답안"과 "정답" 표시
            const userAnswerText = (userAnswer || "").trim();
            
            // 1. 내 답안 표시
            const userAnswerHtml = `
                <div class="mb-2">
                    <span class="text-sm font-bold text-gray-600">내 답안</span>
                    <div class="w-full px-5 py-4 border-2 rounded-xl shadow-sm ${isCorrect ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50'}">
                        ${userAnswerText || "(입력 안 함)"}
                    </div>
                </div>
            `;
            
            // 2. 정답 표시
            const correctAnswerHtml = `
                <div>
                    <span class="text-sm font-bold text-gray-600">정답</span>
                    <div class="w-full px-5 py-4 border-2 border-green-400 bg-green-50 rounded-xl shadow-sm">
                        ${qData.correctAnswerText}
                    </div>
                </div>
            `;
            
            // 오답일 때만 정답을 보여주거나, 항상 보여줄 수 있음 (여기선 항상 표시)
            reviewChoicesContainer.innerHTML = userAnswerHtml + correctAnswerHtml;
        }

        if (qData.explanation) {
            reviewExplanation.innerHTML = `<span class="explanation-label">[해설]</span> ${formatTextToHtml(qData.explanation)}`;
            reviewExplanation.classList.remove('hidden');
        } else {
            reviewExplanation.classList.add('hidden');
        }

        prevResultBtn.disabled = (currentReviewIndex === 0);
        nextResultBtn.disabled = (currentReviewIndex === currentQuizQuestions.length - 1);
    }

    // 풀이 기록 DB 업데이트 (로컬)
    function updateSolveHistory(setId, qIndex, isCorrect) {
        if (!setId || !qIndex) return;

        try {
            // Qset ID와 Question ID (1~20)로 기존 기록 찾기
            let entry = currentUser.history.find(h => h.QsetID === setId && h.QuestionID === qIndex);

            if (entry) {
                // 기존 기록이 있으면 업데이트
                entry.TimesAppeared += 1;
                if (isCorrect) {
                    entry.TimesCorrect += 1;
                }
            } else {
                // 새 기록 추가
                currentUser.history.push({
                    QsetID: setId,
                    QuestionID: qIndex,
                    TimesAppeared: 1,
                    TimesCorrect: isCorrect ? 1 : 0
                });
            }
        } catch (error) {
            console.error('풀이 기록 업데이트 중 오류:', error);
        }
    }

    function updateDailyCount() {
        try {
            const todayKST = getKSTDateString(); // "25.11.05"

            // 오늘 날짜("25.11.05")를 키로 가진 객체 찾기
            let todayEntry = currentUser.dailyCounts.find(entry => entry.hasOwnProperty(todayKST));

            if (todayEntry) {
                // 오늘 날짜 기록이 있으면 카운트 증가
                todayEntry[todayKST]++;
            } else {
                // 오늘 날짜 기록이 없으면 새 객체 생성 후 배열에 추가
                // { "25.11.05": 1 }
                const newEntry = {};
                newEntry[todayKST] = 1;
                currentUser.dailyCounts.push(newEntry);
            }
            console.log("Daily count updated:", currentUser.dailyCounts);
        } catch (error) {
            console.error('일자별 풀이 횟수 업데이트 중 오류:', error);
        }
    }

    // 사용자 데이터 업로드 (풀이 기록 갱신)
    async function uploadUserData() {
        if (!currentUser.id) {
            console.error('업로드할 사용자 ID가 없습니다.');
            return;
        }

        console.log("--- UPLOAD START ---");
        // 현재 메모리 상태의 값을 복사하여 로그 출력
        console.log("Data to be sent (history):", JSON.parse(JSON.stringify(currentUser.history)));
        console.log("Data to be sent (dailyCounts):", JSON.parse(JSON.stringify(currentUser.dailyCounts)));

        const dataToSend = {
            id: currentUser.id,
            // (수정) KST 타임스탬프 함수 사용
            lastAccess: getKSTTimestampString(),
            // (수정) stringify 제거. 배열/객체 원본을 보냄
            history: currentUser.history,
            // (수정) stringify 제거. 배열/객체 원본을 보냄 (파일에 이미 이렇게 되어있음)
            dailyCounts: currentUser.dailyCounts,
            quizLog: currentUser.quizLog
        };

        console.log("Final dataToSend object (pre-body):", dataToSend);

        try {
            const response = await fetch(UPLOAD_WEBHOOK_URL, {
                method: 'POST', // 또는 서버 설정에 맞게
                headers: { 'Content-Type': 'application/json' },
                // dataToSend 객체 전체가 여기서 1번만 stringify 됩니다.
                body: JSON.stringify(dataToSend)
            });
            if (response.ok) {
                console.log("--- UPLOAD SUCCESS ---");
            } else {
                console.error("--- UPLOAD FAILED (Server Error) ---", response.status);
            }
        } catch (error) {
            console.error("--- UPLOAD FAILED (Network Error) ---", error);
        }
    }

    // === 이벤트 리스너 초기화 ===
    function initializeEventListeners() {
        // 퀴즈 진행 버튼
        prevBtn.onclick = handlePrev;
        nextBtn.onclick = handleNext;
        submitBtn.onclick = handleSubmit;

        // 결과 리뷰 버튼
        prevResultBtn.onclick = () => jumpToReview(currentReviewIndex - 1);
        nextResultBtn.onclick = () => jumpToReview(currentReviewIndex + 1);
        
        backToStartBtn.onclick = () => {
            showScreen('lobby');
        };

        // (신규) 모달 버튼 이벤트 리스너
        openResultsModalBtn.onclick = () => {
            resultsListModal.classList.remove('hidden');
            // 모달 열 때 현재 리뷰 중인 문항 하이라이트
            resultsListModalContent.querySelectorAll('.result-item').forEach(btn => {
                btn.classList.toggle('ring-2', btn.dataset.resultIndex == currentReviewIndex);
                btn.classList.toggle('ring-blue-500', btn.dataset.resultIndex == currentReviewIndex);
            });
        };
        closeResultsModalBtn.onclick = () => {
            resultsListModal.classList.add('hidden');
        };

        // (수정) 시작 버튼 리스너는 DB 로드 후 initializeStartScreen에서 연결
    }

    // === 앱 시작 ===
    function init() {
        initializeEventListeners();
        initializeLoginScreen();
        initializeSignupScreen();
        showScreen('login');
    }

    document.addEventListener('DOMContentLoaded', init);

})();