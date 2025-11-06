(function() {
    // === 상수 정의 ===
    const GET_ALL_DATA_URL = 'https://hook.us2.make.com/b9xwyr91bi39ggll19qe7jrjg9l4l75c';

    // === 영역별 Q Set 매핑 ===
    const CATEGORY_MAPPING = {
        '품사': ['Q001~Q014', 'Q018~Q020', 'Q101~Q107'],
        '문장 성분': ['Q021~Q038', 'Q201~Q235'],
        '문장의 짜임': ['Q401~Q406'],
        '음운의 체계': ['Q501~Q504']
    };

    // === 전역 변수 ===
    let allUsers = [];
    let filteredUsers = [];
    let selectedUser = null;

    // === DOM 요소 캐시 ===
    const screens = {
        loading: document.getElementById('loading-screen'),
        userList: document.getElementById('user-list-screen'),
        report: document.getElementById('report-screen')
    };

    const loadingMessage = document.getElementById('loading-message');
    const searchInput = document.getElementById('search-input');
    const userListContainer = document.getElementById('user-list-container');
    const emptyState = document.getElementById('empty-state');
    const backBtn = document.getElementById('back-btn');
    const printBtn = document.getElementById('print-btn');

    // 리포트 화면 요소
    const reportUserName = document.getElementById('report-user-name');
    const reportDate = document.getElementById('report-date');
    const reportLastAccess = document.getElementById('report-last-access');
    
    // 종합 통계
    const reportTotalSessions = document.getElementById('report-total-sessions');
    const reportTotalQuestions = document.getElementById('report-total-questions');
    const reportCorrectAnswers = document.getElementById('report-correct-answers');
    const reportAccuracy = document.getElementById('report-accuracy');
    const reportCategoryTotal = document.getElementById('report-category-total');
    
    // 최근 7일 통계
    const reportWeekSessions = document.getElementById('report-week-sessions');
    const reportWeekQuestions = document.getElementById('report-week-questions');
    const reportWeekCorrect = document.getElementById('report-week-correct');
    const reportWeekAccuracy = document.getElementById('report-week-accuracy');
    const reportDailyChart = document.getElementById('report-daily-chart');
    const reportCategoryWeek = document.getElementById('report-category-week');

    // === 헬퍼 함수 ===

    function showScreen(screenName) {
        Object.values(screens).forEach(screen => screen.classList.add('hidden'));
        if (screens[screenName]) {
            screens[screenName].classList.remove('hidden');
            screens[screenName].classList.add('fade-in');
        }
    }

    function getKSTDateString(daysAgo = 0) {
        const now = new Date();
        const kstOffset = 9 * 60 * 60 * 1000;
        const kstDate = new Date(now.getTime() + kstOffset - (daysAgo * 24 * 60 * 60 * 1000));
        
        const year = String(kstDate.getUTCFullYear()).slice(2);
        const month = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(kstDate.getUTCDate()).padStart(2, '0');
        
        return `${year}.${month}.${day}`;
    }

    function formatLastAccess(lastAccessStr) {
        if (!lastAccessStr) return '접속 기록 없음';
        
        try {
            const [datePart, timePart] = lastAccessStr.split(' ');
            let year, month, day;
            
            if (datePart.includes('-')) {
                [year, month, day] = datePart.split('-');
            } else if (datePart.includes('.')) {
                [year, month, day] = datePart.split('.');
                year = `20${year}`;
            } else {
                return lastAccessStr;
            }
            
            return `${year}년 ${parseInt(month)}월 ${parseInt(day)}일 ${timePart}`;
        } catch (error) {
            return lastAccessStr;
        }
    }

    function getLast7DaysLabels() {
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        const labels = [];
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            const kstOffset = 9 * 60 * 60 * 1000;
            const kstDate = new Date(date.getTime() + kstOffset - (i * 24 * 60 * 60 * 1000));
            
            const dayOfWeek = days[kstDate.getUTCDay()];
            const month = kstDate.getUTCMonth() + 1;
            const day = kstDate.getUTCDate();
            
            labels.push(`${dayOfWeek}\n${month}/${day}`);
        }
        
        return labels;
    }

    function findCategory(qsetId) {
        // qsetId (예: "Q005")에서 숫자 부분(5)을 추출합니다.
        const qsetNum = parseInt(qsetId.replace('Q', ''));

        // 유효한 Q-set ID가 아니면 '기타'로 처리합니다.
        if (isNaN(qsetNum)) {
            return '기타';
        }

        // 정의된 모든 카테고리를 순회합니다.
        for (const [category, ranges] of Object.entries(CATEGORY_MAPPING)) {
            // 카테고리 내의 모든 범위 문자열(예: "Q001~Q014")을 순회합니다.
            for (const rangeStr of ranges) {
                // 범위 문자열(~)이 포함된 경우
                if (rangeStr.includes('~')) {
                    const [startStr, endStr] = rangeStr.split('~');
                    const start = parseInt(startStr.replace('Q', ''));
                    const end = parseInt(endStr.replace('Q', ''));

                    // qsetNum이 시작값과 끝값 사이에 있는지 확인합니다.
                    if (!isNaN(start) && !isNaN(end) && qsetNum >= start && qsetNum <= end) {
                        return category; // 일치하는 카테고리 반환
                    }
                } 
                // 범위가 아닌 단일 Q-set ID인 경우 (향후 확장을 위해)
                else {
                    if (rangeStr === qsetId) {
                        return category; // 일치하는 카테고리 반환
                    }
                }
            }
        }

        // 모든 카테고리에 해당하지 않으면 '기타'를 반환합니다.
        return '기타';
    }

    // === PNG 캡처 함수 ===

    async function captureElement(element, options = {}) {
        try {
            const canvas = await html2canvas(element, {
                backgroundColor: '#f8fafc',
                scale: 2.5,
                logging: false,
                useCORS: true,
                allowTaint: true,
                letterRendering: true,
                ...options
            });
            return canvas;
        } catch (error) {
            console.error('캡처 실패:', error);
            throw error;
        }
    }

    function downloadCanvas(canvas, filename) {
        const link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();
    }


    // === API 호출 함수 ===

    async function loadAllData() {
        try {
            loadingMessage.textContent = '학생 데이터를 불러오는 중...';
            
            const response = await fetch(GET_ALL_DATA_URL);
            
            if (!response.ok) {
                throw new Error(`서버 오류: ${response.status}`);
            }
            
            const rawData = await response.json();
            
            if (!Array.isArray(rawData) || rawData.length === 0) {
                throw new Error('데이터가 없습니다.');
            }
            
            allUsers = rawData.map(user => {
                try {
                    let history = [];
                    let dailyCounts = [];
                    let quizLog = [];
                    
                    if (user[6] && user[6] !== '' && user[6] !== null) {
                        try {
                            const fixedString = '[' + user[6] + ']';
                            history = JSON.parse(fixedString);
                        } catch (e) {
                            console.warn('history 파싱 실패:', user[6]);
                        }
                    }
                    
                    if (user[7] && user[7] !== '' && user[7] !== null) {
                        try {
                            const fixedString = '[' + user[7] + ']';
                            dailyCounts = JSON.parse(fixedString);
                        } catch (e) {
                            console.warn('dailyCounts 파싱 실패:', user[7]);
                        }
                    }
                    
                    if (user[8] && user[8] !== '' && user[8] !== null) {
                        try {
                            const fixedString = '[' + user[8] + ']';
                            quizLog = JSON.parse(fixedString);
                        } catch (e) {
                            console.warn('quizLog 파싱 실패:', user[8]);
                        }
                    }
                    
                    return {
                        id: user[0] || '',
                        name: user[2] || '이름없음',
                        lastAccess: user[5] || '',
                        history: history,
                        dailyCounts: dailyCounts,
                        quizLog: quizLog
                    };
                } catch (parseError) {
                    console.error(`유저 파싱 오류:`, parseError, user);
                    return {
                        id: user[0] || '',
                        name: user[2] || '이름없음',
                        lastAccess: user[5] || '',
                        history: [],
                        dailyCounts: [],
                        quizLog: []
                    };
                }
            });
            
            filteredUsers = [...allUsers];
            renderUserList();
            showScreen('userList');
            
        } catch (error) {
            console.error('데이터 로딩 실패:', error);
            loadingMessage.textContent = '데이터를 불러오는 데 실패했습니다.';
            alert('학생 데이터를 불러오는 데 실패했습니다.\n' + error.message);
        }
    }

    function showUserReport(userId) {
        const userData = allUsers.find(user => user.id === userId);
        
        if (!userData) {
            alert('해당 학생 데이터를 찾을 수 없습니다.');
            return;
        }
        
        selectedUser = userData;
        const stats = calculateStats(userData);
        renderReport(userData, stats);
        showScreen('report');
        window.scrollTo(0, 0);
    }

    // === 통계 계산 함수 ===

    function calculateStats(userData) {
        const stats = {
            // 종합 통계
            totalSessions: 0,
            totalQuestions: 0,
            correctAnswers: 0,
            accuracy: 0,
            categoryTotal: {},
            
            // 최근 7일 통계
            weekSessions: 0,
            weekQuestions: 0,
            weekCorrect: 0,
            weekAccuracy: 0,
            last7DaysSessions: [0, 0, 0, 0, 0, 0, 0], // 일별 퀴즈 풀이 횟수
            categoryWeek: {}
        };
        
        // 1. 종합 통계 - 총 풀이 횟수 (quizLog 개수)
        // (참고: quizLog가 상세 로그로 바뀌었으므로, "총 풀이 횟수"의 정의가 모호해졌습니다.)
        // (여기서는 이전 로직을 유지하되, 상세 로그의 "고유 time" 개수를 세는 것을 권장합니다.)
        // (단, 'history' 기반으로 계산하는 아래 로직이 더 정확할 수 있습니다.)
        
        // (임시) quizLog의 고유 세션 수로 totalSessions 계산
        if (userData.quizLog && Array.isArray(userData.quizLog)) {
             const uniqueTotalSessions = new Set(userData.quizLog.map(log => log.time));
             stats.totalSessions = uniqueTotalSessions.size;
        } else {
             stats.totalSessions = 0;
        }

        
        // 2. 종합 통계 - history 기반 계산 (기존 로직 유지)
        if (userData.history && Array.isArray(userData.history)) {
            userData.history.forEach(h => {
                const appeared = parseInt(h.TimesAppeared) || 0;
                const correct = parseInt(h.TimesCorrect) || 0;
                
                stats.totalQuestions += appeared;
                stats.correctAnswers += correct;
                
                const qsetId = h.QsetID || 'Unknown';
                const category = findCategory(qsetId);
                
                if (!stats.categoryTotal[category]) {
                    stats.categoryTotal[category] = { correct: 0, total: 0 };
                }
                stats.categoryTotal[category].correct += correct;
                stats.categoryTotal[category].total += appeared;
            });
        }
        
        if (stats.totalQuestions > 0) {
            stats.accuracy = (stats.correctAnswers / stats.totalQuestions * 100).toFixed(1);
        }
        
        // 3. 카테고리별 정답률 계산 (종합) (기존 로직 유지)
        Object.keys(stats.categoryTotal).forEach(category => {
            const data = stats.categoryTotal[category];
            if (data.total > 0) {
                data.rate = (data.correct / data.total * 100).toFixed(1);
            } else {
                data.rate = 0;
            }
        });
        
        // ==============================================================
        // 4. 최근 7일 통계 계산 (quizLog 기반: 상세 로그) (*** 수정된 부분 ***)
        // ==============================================================
        if (userData.quizLog && Array.isArray(userData.quizLog)) {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            
            // 최근 7일 데이터 필터링 (상세 로그)
            // { time: "2025-11-06 09:15:10", QsetID: "Q001", correct: true }
            const recentLogs = userData.quizLog.filter(log => {
                if (log.time) {
                    const logDate = new Date(log.time);
                    return logDate >= sevenDaysAgo;
                }
                return false;
            });
            
            // 4-1. 7일간 총 풀이 횟수 (세션 수: 고유한 timestamp 개수)
            const uniqueSessions = new Set(recentLogs.map(log => log.time));
            stats.weekSessions = uniqueSessions.size;
            
            // 4-2. 7일간 총 풀이 문항 수 (상세 로그의 개수)
            stats.weekQuestions = recentLogs.length;
            
            // 4-3. 7일간 정답 수 및 영역별 통계
            let weekCorrectCount = 0;
            recentLogs.forEach(log => {
                // 정답 수 계산
                if (log.correct) {
                    weekCorrectCount++;
                }
                
                // 영역별 통계 (최근 7일) - findCategory 사용
                const category = findCategory(log.QsetID); // "QsetID" 필드 사용
                
                if (!stats.categoryWeek[category]) {
                    stats.categoryWeek[category] = { correct: 0, total: 0 };
                }
                
                stats.categoryWeek[category].total++;
                stats.categoryWeek[category].correct += (log.correct ? 1 : 0);
            });
            
            stats.weekCorrect = weekCorrectCount;
            
            if (stats.weekQuestions > 0) {
                stats.weekAccuracy = (stats.weekCorrect / stats.weekQuestions * 100).toFixed(1);
            }
            
            // 5. 일별 퀴즈 풀이 횟수 계산 (세션 수 기준)
            for (let i = 0; i < 7; i++) {
                const targetDate = getKSTDateString(6 - i); // 예: "25.11.06"
                
                // 그 날짜에 해당하는 로그만 필터링
                const dailyLogs = recentLogs.filter(log => {
                    if (log.time) {
                        // "2025-11-06 09:15:10" 형식에서 날짜만 추출
                        const logDateStr = log.time.split(' ')[0]; // "2025-11-06"
                        const [year, month, day] = logDateStr.split('-');
                        const formattedDate = `${year.slice(2)}.${month}.${day}`;
                        return formattedDate === targetDate;
                    }
                    return false;
                });
                
                // 그 날짜의 고유한 세션(timestamp) 수 계산
                const uniqueDailySessions = new Set(dailyLogs.map(log => log.time));
                stats.last7DaysSessions[i] = uniqueDailySessions.size;
            }
        }
        // ==============================================================
        // (*** 수정 끝 ***)
        // ==============================================================
        
        // 6. 카테고리별 정답률 계산 (최근 7일)
        Object.keys(stats.categoryWeek).forEach(category => {
            const data = stats.categoryWeek[category];
            if (data.total > 0) {
                data.rate = (data.correct / data.total * 100).toFixed(1);
            } else {
                data.rate = 0;
            }
        });
        
        return stats;
    }

    // === 렌더링 함수 ===

    function renderUserList() {
        userListContainer.innerHTML = '';
        
        if (filteredUsers.length === 0) {
            emptyState.classList.remove('hidden');
            return;
        } else {
            emptyState.classList.add('hidden');
        }
        
        filteredUsers.forEach(user => {
            const card = document.createElement('div');
            card.className = 'user-card';
            
            const lastAccessText = user.lastAccess || '기록 없음';
            
            card.innerHTML = `
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="text-2xl">👤</span>
                            <h3 class="text-xl font-bold text-gray-900">${user.name}</h3>
                        </div>
                        <p class="text-sm text-gray-600">
                            <span class="font-semibold">최근 접속:</span> ${lastAccessText}
                        </p>
                    </div>
                    <div class="text-right">
                        <span class="text-3xl">→</span>
                    </div>
                </div>
            `;
            
            card.onclick = () => showUserReport(user.id);
            userListContainer.appendChild(card);
        });
    }

    function renderReport(userData, stats) {
        // 유저 이름 (학생 추가)
        reportUserName.textContent = `${userData.name || '이름 없음'} 학생`;
        
        // 현재 날짜 표시 (한국 시간 기준)
        reportDate.textContent = getKSTDateString(0);
        
        // 최근 접속 (숨김)
        reportLastAccess.textContent = formatLastAccess(userData.lastAccess);
        
        // 종합 통계
        reportTotalSessions.textContent = stats.totalSessions;
        reportTotalQuestions.textContent = stats.totalQuestions;
        reportCorrectAnswers.textContent = stats.correctAnswers;
        reportAccuracy.innerHTML = `${stats.accuracy}<span style="font-size: 1.2rem;">%</span>`;
        
        // 최근 7일 통계
        reportWeekSessions.textContent = stats.weekSessions;
        reportWeekQuestions.textContent = stats.weekQuestions;
        reportWeekCorrect.textContent = stats.weekCorrect;
        reportWeekAccuracy.innerHTML = `${stats.weekAccuracy}<span style="font-size: 1.2rem;">%</span>`;
        
        // 막대 그래프
        renderDailyChart(stats.last7DaysSessions);
        
        // 영역별 통계
        renderCategoryAccuracy(reportCategoryTotal, stats.categoryTotal);
        renderCategoryAccuracy(reportCategoryWeek, stats.categoryWeek);
    }

    function renderDailyChart(dailyData) {
        reportDailyChart.innerHTML = '';
        
        const maxValue = Math.max(...dailyData, 1);
        const labels = getLast7DaysLabels();
        
        dailyData.forEach((count, index) => {
            const barWrapper = document.createElement('div');
            barWrapper.className = 'bar-wrapper';
            
            const bar = document.createElement('div');
            bar.className = 'bar';
            
            const heightPercent = maxValue > 0 ? (count / maxValue) * 100 : 0;
            const heightPx = (heightPercent / 100) * 120;
            bar.style.height = `${heightPx}px`;
            
            if (count > 0) {
                const value = document.createElement('div');
                value.className = 'bar-value';
                value.textContent = count;
                bar.appendChild(value);
            }
            
            const label = document.createElement('div');
            label.className = 'bar-label';
            label.innerHTML = labels[index].replace('\n', '<br>');
            
            barWrapper.appendChild(bar);
            barWrapper.appendChild(label);
            reportDailyChart.appendChild(barWrapper);
        });
    }

    function renderCategoryAccuracy(container, categoryData) {
        container.innerHTML = '';
        
        const categories = Object.keys(categoryData).sort();
        
        if (categories.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-4">데이터가 없습니다</p>';
            return;
        }
        
        categories.forEach(category => {
            const data = categoryData[category];
            const rate = parseFloat(data.rate);
            
            const div = document.createElement('div');
            div.className = 'mb-4';
            
            let fillClass = '';
            if (rate < 60) {
                fillClass = 'low';
            } else if (rate < 80) {
                fillClass = 'medium';
            }
            
            div.innerHTML = `
                <div class="flex justify-between items-center mb-2">
                    <span class="text-sm font-bold text-gray-700">${category}</span>
                    <span class="text-xs text-gray-500">${data.correct}/${data.total}</span>
                </div>
                <div class="progress-container">
                    <div class="progress-fill ${fillClass}" style="width: ${rate}%">
                        ${rate}%
                    </div>
                </div>
            `;
            
            container.appendChild(div);
        });
    }

    // === 검색 기능 ===

    function handleSearch() {
        const searchTerm = searchInput.value.trim().toLowerCase();
        
        if (searchTerm === '') {
            filteredUsers = [...allUsers];
        } else {
            filteredUsers = allUsers.filter(user => 
                user.name.toLowerCase().includes(searchTerm)
            );
        }
        
        renderUserList();
    }

    // === 이벤트 리스너 초기화 ===

    function initializeEventListeners() {
        searchInput.addEventListener('input', handleSearch);
        
        backBtn.addEventListener('click', () => {
            showScreen('userList');
            window.scrollTo(0, 0);
        });

        printBtn.addEventListener('click', async () => {
            if (!selectedUser) {
                alert('리포트를 먼저 불러와주세요.');
                return;
            }

            try {
                printBtn.disabled = true;
                printBtn.innerHTML = '<span>⏳</span><span>높이 계산 중...</span>';

                const header = document.getElementById('report-header');
                const totalStats = document.getElementById('total-stats-section');
                const weekStats = document.getElementById('week-stats-section');
                
                const userName = selectedUser.name;
                const dateStr = getKSTDateString(0);

                // 폰트 로딩 대기
                await document.fonts.ready;

                // === 높이 계산을 위한 임시 컨테이너 ===
                const tempContainer1 = document.createElement('div');
                tempContainer1.style.position = 'absolute';
                tempContainer1.style.left = '-9999px';
                tempContainer1.style.width = '680px';
                tempContainer1.style.padding = '30px';
                tempContainer1.style.visibility = 'hidden';
                tempContainer1.appendChild(header.cloneNode(true));
                tempContainer1.appendChild(totalStats.cloneNode(true));
                document.body.appendChild(tempContainer1);
                
                const tempContainer2 = document.createElement('div');
                tempContainer2.style.position = 'absolute';
                tempContainer2.style.left = '-9999px';
                tempContainer2.style.width = '680px';
                tempContainer2.style.padding = '30px';
                tempContainer2.style.visibility = 'hidden';
                tempContainer2.appendChild(header.cloneNode(true));
                tempContainer2.appendChild(weekStats.cloneNode(true));
                document.body.appendChild(tempContainer2);
                
                // 강제 reflow 트리거
                tempContainer1.offsetHeight;
                tempContainer2.offsetHeight;
                
                await new Promise(resolve => setTimeout(resolve, 200));
                
                const totalHeight = tempContainer1.offsetHeight;
                const weekHeight = tempContainer2.offsetHeight;
                
                document.body.removeChild(tempContainer1);
                document.body.removeChild(tempContainer2);
                
                // 더 큰 높이를 목표 높이로 설정
                const targetHeight = Math.max(totalHeight, weekHeight);

                printBtn.innerHTML = '<span>⏳</span><span>종합통계 생성 중...</span>';

                // === 1. 종합 통계 PNG 생성 ===
                const totalContainer = document.createElement('div');
                totalContainer.className = 'capture-mode';
                totalContainer.style.position = 'absolute';
                totalContainer.style.left = '-9999px';
                totalContainer.style.width = '680px';
                totalContainer.style.height = `${targetHeight}px`;
                totalContainer.style.padding = '30px';
                totalContainer.style.backgroundColor = '#f8fafc';
                totalContainer.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", sans-serif';
                totalContainer.style.display = 'flex';
                totalContainer.style.flexDirection = 'column';
                totalContainer.style.boxSizing = 'border-box';
                
                const headerClone1 = header.cloneNode(true);
                const totalStatsClone = totalStats.cloneNode(true);
                
                // 종합 통계가 짧으면 아래 여백 추가
                if (totalHeight < targetHeight) {
                    const gap = targetHeight - totalHeight;
                    totalStatsClone.style.marginBottom = `${gap}px`;
                }
                
                totalContainer.appendChild(headerClone1);
                totalContainer.appendChild(totalStatsClone);
                
                document.body.appendChild(totalContainer);
                
                // DOM이 완전히 렌더링될 때까지 대기
                await new Promise(resolve => setTimeout(resolve, 300));
                
                const totalCanvas = await captureElement(totalContainer, {
                    scale: 2.5,
                    backgroundColor: '#f8fafc',
                    windowWidth: 680,
                    windowHeight: targetHeight
                });
                const totalFilename = `${userName}_${dateStr}_종합통계.png`;
                downloadCanvas(totalCanvas, totalFilename);
                
                document.body.removeChild(totalContainer);
                
                // 약간의 딜레이 (다운로드가 겹치지 않도록)
                await new Promise(resolve => setTimeout(resolve, 500));

                // === 2. 주간 통계 PNG 생성 ===
                printBtn.innerHTML = '<span>⏳</span><span>주간통계 생성 중...</span>';
                
                const weekContainer = document.createElement('div');
                weekContainer.className = 'capture-mode';
                weekContainer.style.position = 'absolute';
                weekContainer.style.left = '-9999px';
                weekContainer.style.width = '680px';
                weekContainer.style.height = `${targetHeight}px`;
                weekContainer.style.padding = '30px';
                weekContainer.style.backgroundColor = '#f8fafc';
                weekContainer.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", sans-serif';
                weekContainer.style.display = 'flex';
                weekContainer.style.flexDirection = 'column';
                weekContainer.style.boxSizing = 'border-box';
                
                const headerClone2 = header.cloneNode(true);
                const weekStatsClone = weekStats.cloneNode(true);
                
                // 주간 통계가 짧으면 아래 여백 추가 (드물지만)
                if (weekHeight < targetHeight) {
                    const gap = targetHeight - weekHeight;
                    weekStatsClone.style.marginBottom = `${gap}px`;
                }
                
                weekContainer.appendChild(headerClone2);
                weekContainer.appendChild(weekStatsClone);
                
                document.body.appendChild(weekContainer);
                
                // DOM이 완전히 렌더링될 때까지 대기
                await new Promise(resolve => setTimeout(resolve, 300));
                
                const weekCanvas = await captureElement(weekContainer, {
                    scale: 2.5,
                    backgroundColor: '#f8fafc',
                    windowWidth: 680,
                    windowHeight: targetHeight
                });
                const weekFilename = `${userName}_${dateStr}_주간통계.png`;
                downloadCanvas(weekCanvas, weekFilename);
                
                document.body.removeChild(weekContainer);
                
                alert(`✅ ${userName} 학생 리포트 저장 완료!\n\n📁 저장된 파일:\n1️⃣ ${totalFilename}\n2️⃣ ${weekFilename}\n\n다운로드 폴더를 확인해주세요.`);
                
            } catch (error) {
                console.error('저장 실패:', error);
                alert('❌ 리포트 저장에 실패했습니다.\n\n잠시 후 다시 시도해주세요.');
            } finally {
                printBtn.disabled = false;
                printBtn.innerHTML = '<span>📥</span><span>PNG로 저장하기</span>';
            }
        });
    }

    // === 앱 초기화 ===

    async function init() {
        initializeEventListeners();
        showScreen('loading');
        await loadAllData();
    }

    document.addEventListener('DOMContentLoaded', init);

})();