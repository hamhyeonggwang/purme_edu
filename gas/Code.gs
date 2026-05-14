// ============================================================
// 푸르메재단 넥슨어린이재활병원 재활치료센터
// 신규입사자 집합교육 운영 플랫폼 - Google Apps Script
// ============================================================

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const SHEETS = {
  COURSES: '교육목록',
  REGISTRATIONS: '신청자',
  ATTENDANCE: '출석',
  SURVEYS: '설문완료',
  COMPLETIONS: '수료현황',
  NOTICES: '공지사항',
  EMPLOYEES: '사원명부',
  SESSIONS: '로그인세션'
};

const SESSION_TTL_HOURS = 12;

// ============================================================
// CORS & 라우팅
// ============================================================
function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    const body = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : null;
    const params = body || e.parameter || {};
    const action = params.action || (e.parameter && e.parameter.action);
    const authResult = authorizeAction(action, params);
    if (!authResult.success) {
      output.setContent(JSON.stringify(authResult));
      return output;
    }
    params.auth = authResult.auth || null;

    let result;
    switch (action) {
      case 'login':             result = login(params); break;
      case 'logout':            result = logout(params); break;
      case 'getMe':             result = getMe(params); break;
      case 'changePin':         result = changePin(params); break;
      case 'getCourses':        result = getCourses(params); break;
      case 'getCourseById':     result = getCourseById(params); break;
      case 'registerCourse':    result = registerCourse(params); break;
      case 'checkAttendance':   result = checkAttendance(params); break;
      case 'completeSurvey':    result = completeSurvey(params); break;
      case 'getDashboard':      result = getDashboard(params); break;
      case 'getRegistrations':  result = getRegistrations(params); break;
      case 'getAttendance':     result = getAttendanceList(params); break;
      case 'getCompletions':    result = getCompletions(params); break;
      case 'getNotices':        result = getNotices(params); break;
      case 'createNotice':      result = createNotice(params); break;
      case 'updateNotice':      result = updateNotice(params); break;
      case 'deleteNotice':      result = deleteNotice(params); break;
      case 'createCourse':      result = createCourse(params); break;
      case 'updateCourse':      result = updateCourse(params); break;
      case 'deleteCourse':      result = deleteCourse(params); break;
      case 'generateQR':        result = generateQRData(params); break;
      case 'initSheets':        result = initializeSheets(); break;
      case 'resetEmployeePin':  result = resetEmployeePin(params); break;
      default:
        result = { success: false, error: '알 수 없는 액션입니다.' };
    }

    output.setContent(JSON.stringify(result));
  } catch (err) {
    output.setContent(JSON.stringify({ success: false, error: err.message }));
  }

  return output;
}

// ============================================================
// 시트 초기화
// ============================================================
function initializeSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  const sheetConfigs = [
    {
      name: SHEETS.COURSES,
      headers: ['교육ID', '교육명', '설명', '날짜', '시작시간', '종료시간', '장소', '정원', '신청수',
        '상태', '영상URL', '자료URL', '설문URL', '출석시작', '출석종료', '생성일']
    },
    {
      name: SHEETS.REGISTRATIONS,
      headers: ['신청ID', '교육ID', '이름', '부서', '직군', '연락처', '신청일시', '상태']
    },
    {
      name: SHEETS.ATTENDANCE,
      headers: ['출석ID', '교육ID', '이름', '부서', '출석시간', '방법']
    },
    {
      name: SHEETS.SURVEYS,
      headers: ['설문ID', '교육ID', '이름', '부서', '제출일시']
    },
    {
      name: SHEETS.COMPLETIONS,
      headers: ['수료ID', '교육ID', '교육명', '이름', '부서', '직군', '수료일시', '출석여부', '설문여부']
    },
    {
      name: SHEETS.NOTICES,
      headers: ['공지ID', '내용', '링크URL', '상태', '생성일']
    },
    {
      name: SHEETS.EMPLOYEES,
      headers: ['사원번호', '이름', '부서', '직군', '연락처', '권한', '상태', 'PIN Salt', 'PIN Hash', '생성일', '최종로그인']
    },
    {
      name: SHEETS.SESSIONS,
      headers: ['세션ID', '사원번호', '토큰Hash', '만료일시', '생성일시', '상태']
    }
  ];

  sheetConfigs.forEach(config => {
    let sheet = ss.getSheetByName(config.name);
    if (!sheet) {
      sheet = ss.insertSheet(config.name);
    }
    // 헤더가 없으면 추가
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(config.headers);
      sheet.getRange(1, 1, 1, config.headers.length)
        .setBackground('#1a5276')
        .setFontColor('#ffffff')
        .setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
  });

  // 샘플 데이터 추가
  addSampleData(ss);

  return { success: true, message: '시트가 초기화되었습니다.' };
}

function addSampleData(ss) {
  const courseSheet = ss.getSheetByName(SHEETS.COURSES);
  if (courseSheet.getLastRow() <= 1) {
    const today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
    const tomorrow = Utilities.formatDate(new Date(Date.now() + 86400000), 'Asia/Seoul', 'yyyy-MM-dd');

    const samples = [
      [generateId('C'), '감염관리 및 손위생 교육', '병원 내 감염예방을 위한 필수 교육입니다. 손위생 6단계와 격리 절차를 다룹니다.',
        today, '09:00', '10:30', '재활치료센터 교육실', 30, 0, '신청가능',
        'https://drive.google.com/file/d/example1', 'https://drive.google.com/file/d/example1_pdf',
        'https://forms.gle/example1', today + ' 08:45', today + ' 09:15', new Date().toISOString()],
      [generateId('C'), '안전사고 예방 교육', '의료현장 안전사고 예방 및 대처 방법에 관한 교육입니다.',
        today, '14:00', '15:30', '재활치료센터 교육실', 30, 0, '신청가능',
        'https://drive.google.com/file/d/example2', 'https://drive.google.com/file/d/example2_pdf',
        'https://forms.gle/example2', today + ' 13:45', today + ' 14:15', new Date().toISOString()],
      [generateId('C'), '개인정보보호 교육', '의료기관 개인정보보호법 준수 및 환자 정보 관리에 관한 교육입니다.',
        tomorrow, '10:00', '11:00', '재활치료센터 교육실', 25, 0, '신청가능',
        '', '', 'https://forms.gle/example3', tomorrow + ' 09:45', tomorrow + ' 10:15', new Date().toISOString()]
    ];

    samples.forEach(row => courseSheet.appendRow(row));
  }

  const noticeSheet = ss.getSheetByName(SHEETS.NOTICES);
  if (noticeSheet && noticeSheet.getLastRow() <= 1) {
    const now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
    [
      [generateId('N'), '2025년 신규입사자 연간교육 일정 안내', '', '게시', now],
      [generateId('N'), '사용 가능한 브라우저 안내', '', '게시', now]
    ].forEach(row => noticeSheet.appendRow(row));
  }
}

// ============================================================
// 인증/권한
// ============================================================
function getActionRole(action, params) {
  const publicActions = ['login'];
  const employeeActions = [
    'logout', 'getMe', 'changePin',
    'getCourses', 'getCourseById', 'registerCourse',
    'checkAttendance', 'completeSurvey', 'getNotices'
  ];
  const adminActions = [
    'getDashboard', 'getRegistrations', 'getAttendance', 'getCompletions',
    'createNotice', 'updateNotice', 'deleteNotice',
    'createCourse', 'updateCourse', 'deleteCourse',
    'generateQR', 'initSheets', 'resetEmployeePin'
  ];

  if (publicActions.includes(action)) return 'public';
  if (action === 'getNotices' && isTruthy(params.includeHidden)) return 'admin';
  if (employeeActions.includes(action)) return 'employee';
  if (adminActions.includes(action)) return 'admin';
  return 'employee';
}

function authorizeAction(action, params) {
  const role = getActionRole(action, params || {});
  if (role === 'public') return { success: true };

  const auth = requireAuth(params || {});
  if (!auth.success) return auth;

  if (role === 'admin' && auth.auth.role !== 'admin') {
    return { success: false, error: '관리자 권한이 필요합니다.', code: 'FORBIDDEN' };
  }

  return auth;
}

function requireAuth(params) {
  const token = String(params.authToken || params.token || '').trim();
  if (!token) return { success: false, error: '로그인이 필요합니다.', code: 'UNAUTHORIZED' };

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sessionSheet = ss.getSheetByName(SHEETS.SESSIONS);
  const employeeSheet = ss.getSheetByName(SHEETS.EMPLOYEES);
  if (!sessionSheet || !employeeSheet) {
    return { success: false, error: '인증 시트가 준비되지 않았습니다.', code: 'AUTH_NOT_READY' };
  }

  const tokenHash = hashText(token);
  const sessionData = sessionSheet.getDataRange().getValues();
  const sessionHeaders = sessionData[0] || [];
  const idx = headerIndex(sessionHeaders);
  const now = new Date();

  for (let i = 1; i < sessionData.length; i++) {
    const row = sessionData[i];
    if (row[idx['토큰Hash']] !== tokenHash || row[idx['상태']] !== '활성') continue;

      const expiresAt = row[idx['만료일시']] instanceof Date ? row[idx['만료일시']] : new Date(row[idx['만료일시']]);
      if (!expiresAt || expiresAt <= now) {
        sessionSheet.getRange(i + 1, idx['상태'] + 1).setValue('만료');
        return { success: false, error: '로그인 시간이 만료되었습니다.', code: 'SESSION_EXPIRED' };
      }

      const employee = findEmployeeByNo(ss, row[idx['사원번호']]);
      if (!employee || !isActiveEmployee(employee.data)) {
        return { success: false, error: '사용할 수 없는 계정입니다.', code: 'ACCOUNT_DISABLED' };
      }

      return { success: true, auth: toAuthProfile(employee.data) };
    }
  }

  return { success: false, error: '유효하지 않은 로그인입니다.', code: 'UNAUTHORIZED' };
}

function login(params) {
  const employeeNo = String(params.employeeNo || params.employeeId || '').trim();
  const pin = String(params.pin || '').trim();
  if (!employeeNo || !pin) return { success: false, error: '사원번호와 PIN을 입력해 주세요.' };

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const employee = findEmployeeByNo(ss, employeeNo);
  if (!employee || !isActiveEmployee(employee.data)) {
    return { success: false, error: '사원번호 또는 PIN이 올바르지 않습니다.' };
  }

  const storedSalt = String(employee.data['PIN Salt'] || '');
  const storedHash = String(employee.data['PIN Hash'] || '');
  if (!storedSalt || !storedHash || hashPin(pin, storedSalt) !== storedHash) {
    return { success: false, error: '사원번호 또는 PIN이 올바르지 않습니다.' };
  }

  const token = generateSecureToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_HOURS * 60 * 60 * 1000);
  const sessionSheet = ensureSheetWithHeaders(ss, SHEETS.SESSIONS, ['세션ID', '사원번호', '토큰Hash', '만료일시', '생성일시', '상태']);
  sessionSheet.appendRow([generateId('SS'), employeeNo, hashText(token), expiresAt, now, '활성']);

  const lastLoginIdx = employee.headers.indexOf('최종로그인');
  if (lastLoginIdx >= 0) employee.sheet.getRange(employee.rowIndex, lastLoginIdx + 1).setValue(now);

  return {
    success: true,
    token,
    expiresAt: Utilities.formatDate(expiresAt, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'),
    user: toAuthProfile(employee.data)
  };
}

function logout(params) {
  const token = String(params.authToken || params.token || '').trim();
  if (!token) return { success: true };

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.SESSIONS);
  if (!sheet) return { success: true };

  const tokenHash = hashText(token);
  const data = sheet.getDataRange().getValues();
  const headers = data[0] || [];
  const idx = headerIndex(headers);
  for (let i = 1; i < data.length; i++) {
    if (data[i][idx['토큰Hash']] === tokenHash) {
      sheet.getRange(i + 1, idx['상태'] + 1).setValue('로그아웃');
    }
  }
  return { success: true, message: '로그아웃되었습니다.' };
}

function getMe(params) {
  return { success: true, user: params.auth };
}

function changePin(params) {
  const currentPin = String(params.currentPin || '').trim();
  const newPin = String(params.newPin || '').trim();
  if (!currentPin || !newPin) return { success: false, error: '현재 PIN과 새 PIN을 입력해 주세요.' };
  if (newPin.length < 4) return { success: false, error: 'PIN은 4자리 이상으로 설정해 주세요.' };

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const employee = findEmployeeByNo(ss, params.auth.employeeNo);
  if (!employee) return { success: false, error: '사원 정보를 찾을 수 없습니다.' };

  if (hashPin(currentPin, employee.data['PIN Salt']) !== employee.data['PIN Hash']) {
    return { success: false, error: '현재 PIN이 올바르지 않습니다.' };
  }

  setEmployeePinInternal(employee, newPin);
  return { success: true, message: 'PIN이 변경되었습니다.' };
}

function resetEmployeePin(params) {
  const employeeNo = String(params.employeeNo || '').trim();
  const newPin = String(params.newPin || '').trim();
  if (!employeeNo || !newPin) return { success: false, error: '사원번호와 새 PIN을 입력해 주세요.' };
  if (newPin.length < 4) return { success: false, error: 'PIN은 4자리 이상으로 설정해 주세요.' };

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const employee = findEmployeeByNo(ss, employeeNo);
  if (!employee) return { success: false, error: '사원 정보를 찾을 수 없습니다.' };

  setEmployeePinInternal(employee, newPin);
  return { success: true, message: 'PIN이 초기화되었습니다.' };
}

// Apps Script 편집기에서 초기 계정 PIN을 설정할 때 직접 실행할 수 있습니다.
function setEmployeePin(employeeNo, newPin) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const employee = findEmployeeByNo(ss, employeeNo);
  if (!employee) throw new Error('사원 정보를 찾을 수 없습니다.');
  setEmployeePinInternal(employee, newPin);
}

// Apps Script 편집기에서 최초 관리자/사원 계정을 만들 때 직접 실행할 수 있습니다.
function upsertEmployee(employeeNo, name, department, roleName, phone, role, pin) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const headers = ['사원번호', '이름', '부서', '직군', '연락처', '권한', '상태', 'PIN Salt', 'PIN Hash', '생성일', '최종로그인'];
  const sheet = ensureSheetWithHeaders(ss, SHEETS.EMPLOYEES, headers);
  const existing = findEmployeeByNo(ss, employeeNo);
  const now = new Date();

  if (existing) {
    const updates = {
      '이름': name,
      '부서': department,
      '직군': roleName,
      '연락처': phone,
      '권한': role || 'employee',
      '상태': '활성'
    };
    Object.keys(updates).forEach(header => {
      const colIdx = existing.headers.indexOf(header);
      if (colIdx >= 0) existing.sheet.getRange(existing.rowIndex, colIdx + 1).setValue(updates[header]);
    });
    if (pin) setEmployeePinInternal(existing, pin);
    return;
  }

  sheet.appendRow([employeeNo, name, department, roleName, phone, role || 'employee', '활성', '', '', now, '']);
  if (pin) {
    const created = findEmployeeByNo(ss, employeeNo);
    setEmployeePinInternal(created, pin);
  }
}

function setEmployeePinInternal(employee, newPin) {
  const salt = generateSecureToken();
  const pinHash = hashPin(newPin, salt);
  const saltIdx = employee.headers.indexOf('PIN Salt');
  const hashIdx = employee.headers.indexOf('PIN Hash');
  if (saltIdx < 0 || hashIdx < 0) throw new Error('PIN 컬럼이 없습니다.');
  employee.sheet.getRange(employee.rowIndex, saltIdx + 1).setValue(salt);
  employee.sheet.getRange(employee.rowIndex, hashIdx + 1).setValue(pinHash);
}

function findEmployeeByNo(ss, employeeNo) {
  const sheet = ss.getSheetByName(SHEETS.EMPLOYEES);
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return null;
  const headers = data[0];
  const idx = headerIndex(headers);
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx['사원번호']] || '').trim() === String(employeeNo || '').trim()) {
      const obj = {};
      headers.forEach((h, col) => obj[h] = data[i][col]);
      return { sheet, headers, rowIndex: i + 1, data: obj };
    }
  }
  return null;
}

function toAuthProfile(employee) {
  return {
    employeeNo: String(employee['사원번호'] || ''),
    name: String(employee['이름'] || ''),
    department: String(employee['부서'] || ''),
    roleName: String(employee['직군'] || ''),
    phone: String(employee['연락처'] || ''),
    role: String(employee['권한'] || 'employee').trim() === 'admin' ? 'admin' : 'employee'
  };
}

function isActiveEmployee(employee) {
  const status = String(employee['상태'] || '활성').trim();
  return !['비활성', '퇴사', '중지', '삭제'].includes(status);
}

function ensureSheetWithHeaders(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#1a5276')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function headerIndex(headers) {
  const idx = {};
  headers.forEach((h, i) => idx[h] = i);
  return idx;
}

function hashPin(pin, salt) {
  return hashText(`${salt}:${pin}`);
}

function hashText(text) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(digest);
}

function generateSecureToken() {
  return `${Utilities.getUuid()}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function isTruthy(value) {
  return value === true || value === 1 || ['1', 'true', 'yes', 'Y'].includes(String(value || '').trim());
}

// ============================================================
// 교육 관련 함수
// ============================================================
function getCourses(params) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.COURSES);
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) return { success: true, data: [] };

  const headers = data[0];
  const courses = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = normalizeSheetValue(h, row[i]));
    return obj;
  }).filter(c => c['상태'] !== '삭제');

  // 날짜 필터
  if (params.date) {
    return { success: true, data: courses.filter(c => c['날짜'] === params.date) };
  }

  const today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  const includePast = params.includePast && params.includePast !== '0' && params.includePast !== 'false';
  const upcoming = includePast ? courses : courses.filter(c => c['날짜'] >= today);
  upcoming.sort(compareCoursesByDate);

  return { success: true, data: upcoming };
}

function compareCoursesByDate(a, b) {
  const aDate = String(a['날짜'] || '');
  const bDate = String(b['날짜'] || '');
  const aIsDate = /^\d{4}-\d{2}-\d{2}$/.test(aDate);
  const bIsDate = /^\d{4}-\d{2}-\d{2}$/.test(bDate);

  if (aIsDate && bIsDate && aDate !== bDate) return aDate.localeCompare(bDate);
  if (aIsDate !== bIsDate) return aIsDate ? -1 : 1;
  return String(a['시작시간'] || '').localeCompare(String(b['시작시간'] || ''));
}

function normalizeSheetValue(header, value) {
  if (value instanceof Date) {
    if (header === '날짜') {
      return Utilities.formatDate(value, 'Asia/Seoul', 'yyyy-MM-dd');
    }
    if (['시작시간', '종료시간'].includes(header)) {
      return Utilities.formatDate(value, 'Asia/Seoul', 'HH:mm');
    }
    if (['출석시작', '출석종료'].includes(header)) {
      return Utilities.formatDate(value, 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
    }
    return Utilities.formatDate(value, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
  }
  if (header === '날짜') {
    const match = String(value || '').trim().match(/^(\d{4})[-.](\d{1,2})[-.](\d{1,2})$/);
    if (match) {
      return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
    }
  }
  return value;
}

function isSameId(a, b) {
  return String(a).trim() === String(b).trim();
}

function getCourseById(params) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.COURSES);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  for (let i = 1; i < data.length; i++) {
    if (isSameId(data[i][0], params.courseId)) {
      const obj = {};
      headers.forEach((h, idx) => obj[h] = normalizeSheetValue(h, data[i][idx]));
      return { success: true, data: obj };
    }
  }
  return { success: false, error: '교육을 찾을 수 없습니다.' };
}

function createCourse(params) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.COURSES);
  const courseId = generateId('C');

  sheet.appendRow([
    courseId, params.title, params.description,
    params.date, params.startTime, params.endTime,
    params.location, params.capacity || 30, 0, '신청가능',
    params.videoUrl || '', params.materialUrl || '', params.surveyUrl || '',
    params.attendanceStart || '', params.attendanceEnd || '',
    new Date().toISOString()
  ]);

  return { success: true, courseId, message: '교육이 생성되었습니다.' };
}

function updateCourse(params) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.COURSES);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  for (let i = 1; i < data.length; i++) {
    if (isSameId(data[i][0], params.courseId)) {
      const fieldMap = {
        'title': '교육명', 'description': '설명', 'date': '날짜',
        'startTime': '시작시간', 'endTime': '종료시간', 'location': '장소',
        'capacity': '정원', 'status': '상태', 'videoUrl': '영상URL',
        'materialUrl': '자료URL', 'surveyUrl': '설문URL',
        'attendanceStart': '출석시작', 'attendanceEnd': '출석종료'
      };

      Object.keys(fieldMap).forEach(key => {
        if (params[key] !== undefined) {
          const colIdx = headers.indexOf(fieldMap[key]);
          if (colIdx >= 0) sheet.getRange(i + 1, colIdx + 1).setValue(params[key]);
        }
      });
      return { success: true, message: '교육이 수정되었습니다.' };
    }
  }
  return { success: false, error: '교육을 찾을 수 없습니다.' };
}

function deleteCourse(params) {
  return updateCourse({ courseId: params.courseId, status: '삭제' });
}

// ============================================================
// 신청 관련 함수
// ============================================================
function registerCourse(params) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const user = params.auth;

  // 정원 체크
  const courseSheet = ss.getSheetByName(SHEETS.COURSES);
  const courseData = courseSheet.getDataRange().getValues();
  const courseHeaders = courseData[0];
  let courseRow = -1;

  for (let i = 1; i < courseData.length; i++) {
    if (isSameId(courseData[i][0], params.courseId)) {
      courseRow = i;
      break;
    }
  }

  if (courseRow < 0) return { success: false, error: '교육을 찾을 수 없습니다.' };

  const capacityIdx = courseHeaders.indexOf('정원');
  const registeredIdx = courseHeaders.indexOf('신청수');
  const capacity = courseData[courseRow][capacityIdx];
  const registered = courseData[courseRow][registeredIdx];

  if (registered >= capacity) return { success: false, error: '정원이 초과되었습니다.' };

  // 중복 신청 체크
  const regSheet = ss.getSheetByName(SHEETS.REGISTRATIONS);
  const regData = regSheet.getDataRange().getValues();

  for (let i = 1; i < regData.length; i++) {
    if (isSameId(regData[i][1], params.courseId) && regData[i][2] === user.name && regData[i][7] !== '취소') {
      return { success: false, error: '이미 신청하셨습니다.' };
    }
  }

  // 신청 저장
  const regId = generateId('R');
  const now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
  regSheet.appendRow([regId, params.courseId, user.name, user.department, user.roleName, user.phone, now, '신청완료']);

  // 신청수 업데이트
  courseSheet.getRange(courseRow + 1, registeredIdx + 1).setValue(registered + 1);

  return { success: true, regId, message: '신청이 완료되었습니다.' };
}

function getRegistrations(params) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.REGISTRATIONS);
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) return { success: true, data: [] };

  const headers = data[0];
  let rows = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });

  if (params.courseId) rows = rows.filter(r => isSameId(r['교육ID'], params.courseId));
  return { success: true, data: rows };
}

// ============================================================
// 출석 관련 함수
// ============================================================
function checkAttendance(params) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const user = params.auth;

  // 출석 가능 시간 체크
  const courseResult = getCourseById(params);
  if (!courseResult.success) return courseResult;

  const course = courseResult.data;
  const now = new Date();
  const nowStr = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
  const attendanceStart = course['출석시작'];
  const attendanceEnd = course['출석종료'];

  if (attendanceStart && attendanceEnd) {
    if (nowStr < attendanceStart || nowStr > attendanceEnd) {
      return { success: false, error: `출석 가능 시간이 아닙니다.\n(${attendanceStart} ~ ${attendanceEnd})` };
    }
  }

  // 중복 출석 체크
  const attSheet = ss.getSheetByName(SHEETS.ATTENDANCE);
  const attData = attSheet.getDataRange().getValues();

  for (let i = 1; i < attData.length; i++) {
    if (isSameId(attData[i][1], params.courseId) && attData[i][2] === user.name) {
      return { success: false, error: '이미 출석하셨습니다.' };
    }
  }

  // 출석 저장
  const attId = generateId('A');
  const timeStr = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
  attSheet.appendRow([attId, params.courseId, user.name, user.department, timeStr, '참가자 확인']);

  // 수료 체크
  checkCompletion(params.courseId, user.name, ss);

  return { success: true, message: '출석이 완료되었습니다.', time: timeStr, user };
}

function getAttendanceList(params) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.ATTENDANCE);
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) return { success: true, data: [] };

  const headers = data[0];
  let rows = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });

  if (params.courseId) rows = rows.filter(r => isSameId(r['교육ID'], params.courseId));
  return { success: true, data: rows };
}

// ============================================================
// 설문 관련 함수
// ============================================================
function completeSurvey(params) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const user = params.auth;

  // 중복 체크
  const surveySheet = ss.getSheetByName(SHEETS.SURVEYS);
  const surveyData = surveySheet.getDataRange().getValues();

  for (let i = 1; i < surveyData.length; i++) {
    if (isSameId(surveyData[i][1], params.courseId) && surveyData[i][2] === user.name) {
      return { success: false, error: '이미 설문을 완료하셨습니다.' };
    }
  }

  const surveyId = generateId('S');
  const now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
  surveySheet.appendRow([surveyId, params.courseId, user.name, user.department, now]);

  // 수료 체크
  checkCompletion(params.courseId, user.name, ss);

  return { success: true, message: '설문 완료가 기록되었습니다.' };
}

// ============================================================
// 수료 처리
// ============================================================
function checkCompletion(courseId, name, ss) {
  if (!ss) ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 출석 확인
  const attSheet = ss.getSheetByName(SHEETS.ATTENDANCE);
  const attData = attSheet.getDataRange().getValues();
  const hasAttendance = attData.slice(1).some(r => isSameId(r[1], courseId) && r[2] === name);

  // 설문 확인
  const surveySheet = ss.getSheetByName(SHEETS.SURVEYS);
  const surveyData = surveySheet.getDataRange().getValues();
  const hasSurvey = surveyData.slice(1).some(r => isSameId(r[1], courseId) && r[2] === name);

  if (!hasAttendance || !hasSurvey) return;

  // 기존 수료 체크
  const compSheet = ss.getSheetByName(SHEETS.COMPLETIONS);
  const compData = compSheet.getDataRange().getValues();
  const alreadyCompleted = compData.slice(1).some(r => isSameId(r[1], courseId) && r[3] === name);
  if (alreadyCompleted) return;

  // 교육 정보 가져오기
  const courseResult = getCourseById({ courseId });
  const courseName = courseResult.success ? courseResult.data['교육명'] : '';

  // 신청자 정보
  const regSheet = ss.getSheetByName(SHEETS.REGISTRATIONS);
  const regData = regSheet.getDataRange().getValues();
  let dept = '', role = '';
  for (let i = 1; i < regData.length; i++) {
    if (isSameId(regData[i][1], courseId) && regData[i][2] === name) {
      dept = regData[i][3];
      role = regData[i][4];
      break;
    }
  }

  const compId = generateId('CP');
  const now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
  compSheet.appendRow([compId, courseId, courseName, name, dept, role, now, true, true]);
}

function getCompletions(params) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.COMPLETIONS);
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) return { success: true, data: [] };

  const headers = data[0];
  let rows = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });

  if (params.courseId) rows = rows.filter(r => isSameId(r['교육ID'], params.courseId));
  return { success: true, data: rows };
}

// ============================================================
// 공지사항 관련 함수
// ============================================================
function ensureNoticeSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEETS.NOTICES);
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.NOTICES);
    sheet.appendRow(['공지ID', '내용', '링크URL', '상태', '생성일']);
    sheet.getRange(1, 1, 1, 5)
      .setBackground('#1a5276')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    sheet.setFrozenRows(1);
    const now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
    sheet.appendRow([generateId('N'), '2025년 신규입사자 연간교육 일정 안내', '', '게시', now]);
    sheet.appendRow([generateId('N'), '사용 가능한 브라우저 안내', '', '게시', now]);
  }
  return sheet;
}

function getNotices(params) {
  const sheet = ensureNoticeSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { success: true, data: [] };

  const headers = data[0];
  let notices = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = normalizeSheetValue(h, row[i]));
    return obj;
  }).filter(n => n['상태'] !== '삭제');

  if (!params.includeHidden) {
    notices = notices.filter(n => n['상태'] === '게시');
  }

  return { success: true, data: notices };
}

function createNotice(params) {
  const content = String(params.content || '').trim();
  if (!content) return { success: false, error: '공지 내용을 입력해 주세요.' };

  const sheet = ensureNoticeSheet();
  const noticeId = generateId('N');
  const now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
  sheet.appendRow([noticeId, content, params.linkUrl || '', params.status || '게시', now]);

  return { success: true, noticeId, message: '공지사항이 등록되었습니다.' };
}

function updateNotice(params) {
  const content = String(params.content || '').trim();
  if (!content) return { success: false, error: '공지 내용을 입력해 주세요.' };

  const sheet = ensureNoticeSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  for (let i = 1; i < data.length; i++) {
    if (isSameId(data[i][0], params.noticeId)) {
      const updates = {
        '내용': content,
        '링크URL': params.linkUrl || '',
        '상태': params.status || '게시'
      };
      Object.keys(updates).forEach(header => {
        const colIdx = headers.indexOf(header);
        if (colIdx >= 0) sheet.getRange(i + 1, colIdx + 1).setValue(updates[header]);
      });
      return { success: true, message: '공지사항이 수정되었습니다.' };
    }
  }
  return { success: false, error: '공지사항을 찾을 수 없습니다.' };
}

function deleteNotice(params) {
  const sheet = ensureNoticeSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const statusIdx = headers.indexOf('상태');

  for (let i = 1; i < data.length; i++) {
    if (isSameId(data[i][0], params.noticeId)) {
      sheet.getRange(i + 1, statusIdx + 1).setValue('삭제');
      return { success: true, message: '공지사항이 삭제되었습니다.' };
    }
  }
  return { success: false, error: '공지사항을 찾을 수 없습니다.' };
}

// ============================================================
// 대시보드
// ============================================================
function getDashboard(params) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  const courseId = params.courseId;

  const regData = ss.getSheetByName(SHEETS.REGISTRATIONS).getDataRange().getValues();
  const attData = ss.getSheetByName(SHEETS.ATTENDANCE).getDataRange().getValues();
  const surveyData = ss.getSheetByName(SHEETS.SURVEYS).getDataRange().getValues();
  const compData = ss.getSheetByName(SHEETS.COMPLETIONS).getDataRange().getValues();

  const filterById = (data, colIdx) =>
    courseId ? data.slice(1).filter(r => isSameId(r[colIdx], courseId)) : data.slice(1);

  const regs = filterById(regData, 1);
  const atts = filterById(attData, 1);
  const surveys = filterById(surveyData, 1);
  const comps = filterById(compData, 1);

  const totalReg = regs.length;
  const totalAtt = atts.length;
  const totalSurvey = surveys.length;
  const totalComp = comps.length;
  const compRate = totalReg > 0 ? Math.round((totalComp / totalReg) * 100) : 0;

  return {
    success: true,
    data: {
      totalRegistrations: totalReg,
      totalAttendance: totalAtt,
      totalSurveys: totalSurvey,
      totalCompletions: totalComp,
      completionRate: compRate
    }
  };
}

// ============================================================
// 참가자 확인 링크 데이터 생성
// ============================================================
function generateQRData(params) {
  const courseResult = getCourseById(params);
  if (!courseResult.success) return courseResult;

  const course = courseResult.data;
  const baseUrl = ScriptApp.getService().getUrl();
  const qrUrl = `${baseUrl}?action=attendancePage&courseId=${params.courseId}`;

  return {
    success: true,
    data: {
      courseId: params.courseId,
      courseName: course['교육명'],
      qrUrl,
      attendanceStart: course['출석시작'],
      attendanceEnd: course['출석종료']
    }
  };
}

// ============================================================
// 유틸리티
// ============================================================
function generateId(prefix) {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}
