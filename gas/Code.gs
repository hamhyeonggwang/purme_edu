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
  COMPLETIONS: '수료현황'
};

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
    const action = e.parameter.action || (e.postData ? JSON.parse(e.postData.contents).action : null);
    const params = e.postData ? JSON.parse(e.postData.contents) : e.parameter;

    let result;
    switch (action) {
      case 'getCourses':        result = getCourses(params); break;
      case 'getCourseById':     result = getCourseById(params); break;
      case 'registerCourse':    result = registerCourse(params); break;
      case 'checkAttendance':   result = checkAttendance(params); break;
      case 'completeSurvey':    result = completeSurvey(params); break;
      case 'getDashboard':      result = getDashboard(params); break;
      case 'getRegistrations':  result = getRegistrations(params); break;
      case 'getAttendance':     result = getAttendanceList(params); break;
      case 'getCompletions':    result = getCompletions(params); break;
      case 'createCourse':      result = createCourse(params); break;
      case 'updateCourse':      result = updateCourse(params); break;
      case 'deleteCourse':      result = deleteCourse(params); break;
      case 'generateQR':        result = generateQRData(params); break;
      case 'initSheets':        result = initializeSheets(); break;
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

  // 오늘 이후 교육만
  const today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  const upcoming = courses.filter(c => c['날짜'] >= today);
  upcoming.sort((a, b) => {
    if (a['날짜'] !== b['날짜']) return a['날짜'].localeCompare(b['날짜']);
    return a['시작시간'].localeCompare(b['시작시간']);
  });

  return { success: true, data: upcoming };
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
    if (isSameId(regData[i][1], params.courseId) && regData[i][2] === params.name && regData[i][7] !== '취소') {
      return { success: false, error: '이미 신청하셨습니다.' };
    }
  }

  // 신청 저장
  const regId = generateId('R');
  const now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
  regSheet.appendRow([regId, params.courseId, params.name, params.department, params.role, params.phone, now, '신청완료']);

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
    if (isSameId(attData[i][1], params.courseId) && attData[i][2] === params.name) {
      return { success: false, error: '이미 출석하셨습니다.' };
    }
  }

  // 출석 저장
  const attId = generateId('A');
  const timeStr = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
  attSheet.appendRow([attId, params.courseId, params.name, params.department, timeStr, 'QR']);

  // 수료 체크
  checkCompletion(params.courseId, params.name, ss);

  return { success: true, message: '출석이 완료되었습니다.', time: timeStr };
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

  // 중복 체크
  const surveySheet = ss.getSheetByName(SHEETS.SURVEYS);
  const surveyData = surveySheet.getDataRange().getValues();

  for (let i = 1; i < surveyData.length; i++) {
    if (isSameId(surveyData[i][1], params.courseId) && surveyData[i][2] === params.name) {
      return { success: false, error: '이미 설문을 완료하셨습니다.' };
    }
  }

  const surveyId = generateId('S');
  const now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
  surveySheet.appendRow([surveyId, params.courseId, params.name, params.department, now]);

  // 수료 체크
  checkCompletion(params.courseId, params.name, ss);

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
// QR 데이터 생성
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
