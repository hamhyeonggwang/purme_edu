# 재활치료센터 신규입사자 집합교육 운영 플랫폼
## 푸르메재단 넥슨어린이재활병원

---

## 📁 프로젝트 구조

```
purme-edu/
├── index.html              # 메인 페이지 (교육 목록)
├── attendance.html         # QR 출석 페이지
├── player.html             # 영상 재생 페이지
├── admin.html              # 관리자 페이지
├── assets/
│   ├── js/
│   │   └── config.js       # API URL 설정 (반드시 수정)
│   └── images/
│       └── logo.png        # 병원 로고 (선택)
└── gas/
    └── Code.gs             # Google Apps Script 서버 코드
```

---

## 🗃️ Google Spreadsheet 구조

### 시트 1: 교육목록
| 교육ID | 교육명 | 설명 | 날짜 | 시작시간 | 종료시간 | 장소 | 정원 | 신청수 | 상태 | 영상URL | 자료URL | 설문URL | 출석시작 | 출석종료 | 생성일 |
|--------|--------|------|------|----------|----------|------|------|--------|------|---------|---------|---------|---------|---------|--------|

### 시트 2: 신청자
| 신청ID | 교육ID | 이름 | 부서 | 직군 | 연락처 | 신청일시 | 상태 |
|--------|--------|------|------|------|--------|---------|------|

### 시트 3: 출석
| 출석ID | 교육ID | 이름 | 부서 | 출석시간 | 방법 |
|--------|--------|------|------|---------|------|

### 시트 4: 설문완료
| 설문ID | 교육ID | 이름 | 부서 | 제출일시 |
|--------|--------|------|------|---------|

### 시트 5: 수료현황
| 수료ID | 교육ID | 교육명 | 이름 | 부서 | 직군 | 수료일시 | 출석여부 | 설문여부 |
|--------|--------|--------|------|------|------|---------|---------|---------|

---

## 🚀 배포 방법 (단계별)

### STEP 1. Google Spreadsheet 준비

1. **Google Drive** 접속 → 새 스프레드시트 생성
2. 이름: `재활치료센터_교육플랫폼_DB`
3. 스프레드시트 URL에서 ID 복사
   - 예: `https://docs.google.com/spreadsheets/d/[여기가_ID]/edit`

### STEP 2. Google Apps Script 설정

1. 스프레드시트에서 **확장 프로그램 → Apps Script** 클릭
2. 기본 `Code.gs` 내용 전체 삭제
3. `gas/Code.gs` 내용 전체 붙여넣기
4. 상단 **저장** (💾) 클릭

#### 시트 초기화 실행
1. 함수 선택 드롭다운에서 `initializeSheets` 선택
2. **▶ 실행** 클릭
3. 권한 요청 시 → 허용
4. 실행 완료 확인

### STEP 3. Apps Script 웹앱 배포

1. 우측 상단 **배포 → 새 배포** 클릭
2. 유형: **웹앱** 선택
3. 설정:
   - 설명: `교육 플랫폼 API v1`
   - 다음 사용자로 실행: **나** (본인 계정)
   - 액세스 권한: **모든 사용자** (익명 포함)
4. **배포** 클릭
5. **웹앱 URL 복사** (형식: `https://script.google.com/macros/s/.../exec`)

### STEP 4. Frontend 설정

`assets/js/config.js` 파일에서:

```javascript
API_URL: 'https://script.google.com/macros/s/복사한_URL/exec',
```

### STEP 5. 웹 호스팅

#### 방법 A: GitHub + Vercel (권장)
1. GitHub 새 저장소 생성 (예: `purme-edu-platform`)
2. 이 폴더의 파일을 GitHub 저장소에 push
3. Vercel → **Add New... → Project** 클릭
4. GitHub 저장소 선택 후 Import
5. Framework Preset: **Other**
6. Build Command / Output Directory: 비워둠
7. Deploy 클릭
8. 접속 URL:
   - 메인: `https://[vercel-project].vercel.app/`
   - 관리자: `https://[vercel-project].vercel.app/admin`
   - 출석: `https://[vercel-project].vercel.app/attendance`
   - 강의실: `https://[vercel-project].vercel.app/player`

#### 방법 B: GitHub Pages (무료)
1. GitHub 새 저장소 생성 (예: `purme-edu-platform`)
2. 파일 업로드 또는 git push
3. Settings → Pages → Source: `main branch, /root`
4. 접속 URL: `https://[username].github.io/purme-edu-platform/`

#### 방법 C: 로컬 실행 (테스트용)
```bash
# Python 설치 시
cd purme-edu
python -m http.server 8080
# http://localhost:8080/
```

#### 방법 D: Google Sites 임베드
1. 구글 사이트 도구에서 `<embed>` 태그로 각 페이지 삽입

---

## 📱 QR 출석 운영 방법

### 교육 당일 운영 흐름

1. **관리자 페이지** (`admin.html`) 접속
2. **QR 생성** 탭 → 해당 교육 선택
3. QR 코드 **인쇄** (A4 출력 또는 대형 스크린 표시)
4. 직원들이 QR 스캔 → 이름/부서 입력 → 출석 완료
5. 교육 영상 재생 (`player.html`)
6. 영상 종료 후 설문 링크 클릭
7. **자동 수료 처리** 완료

### 출석 시간 제한 설정
관리자에서 교육 생성/수정 시:
- **출석 시작**: 교육 시작 15분 전 (예: 08:45)
- **출석 종료**: 교육 시작 15분 후 (예: 09:15)
- → 지각/조기 출석 방지

---

## 🎬 영상 연동 방법

### YouTube (비공개 영상)
1. YouTube Studio → 영상 업로드
2. 공개 설정: **일부 공개** (링크 있는 사람만)
3. URL 복사 → 관리자 교육 설정에 붙여넣기

### Google Drive 영상
1. Drive에 MP4 업로드
2. 파일 우클릭 → **공유** → 링크 있는 모든 사용자
3. URL 복사 → 관리자에 등록

### 교육자료 PDF
1. Drive에 PDF 업로드
2. 마찬가지로 공유 링크 설정
3. 자료 URL에 등록

---

## 📋 설문 연동 (Google Forms)

1. Google Forms에서 만족도 조사 설문 생성
2. 질문 예시:
   - 교육 내용 이해도 (1-5)
   - 교육 내용의 유용성 (1-5)
   - 개선 의견 (주관식)
3. **응답** 탭 → Google Sheets 연결
4. 설문 URL 복사 → 관리자에 등록

### ⚠️ 설문 완료 자동 감지 (선택 사항)
Forms → Sheets 연결 후, GAS 트리거로 자동 처리:
```javascript
// Code.gs에 추가
function onFormSubmit(e) {
  const name = e.values[1]; // 이름 컬럼 인덱스
  const courseId = e.values[2]; // 교육 ID 컬럼 인덱스
  completeSurvey({ courseId, name, department: e.values[3] });
}
```

---

## 🔧 유지보수

### 정기 작업
- **월 1회**: 만료된 교육 상태 '종료'로 변경
- **분기 1회**: 수료 현황 Excel 다운로드 및 백업
- **연 1회**: 신규 교육 목록 일괄 등록

### 데이터 백업
1. Google Sheets → 파일 → 다운로드 → .xlsx
2. 또는 Apps Script로 자동 백업 설정

### API 업데이트 후 재배포
```
Apps Script → 배포 → 배포 관리 → 수정 → 새 버전 → 배포
```

### 신규 직군/부서 추가
`index.html`과 `attendance.html`의 `<select>` 옵션 수정

---

## 🔐 보안 고려사항

- 관리자 페이지 보호: 간단한 비밀번호 추가 권장
  ```javascript
  // admin.html에 추가
  const pw = prompt('관리자 비밀번호를 입력하세요');
  if (pw !== '병원비밀번호') { location.href = 'index.html'; }
  ```
- GAS는 익명 접근 허용 → 민감 데이터 최소화
- 개인정보(이름, 연락처)는 Google Workspace 내부 보관

---

## ❓ 트러블슈팅

### API 응답이 없을 때
1. `config.js`의 API_URL 확인
2. GAS 배포 URL이 정확한지 확인
3. 브라우저 Console(F12)에서 오류 메시지 확인

### 출석이 기록되지 않을 때
1. 출석 가능 시간 설정 확인
2. 이름 입력이 신청자 이름과 정확히 일치하는지 확인

### QR이 작동하지 않을 때
1. QR URL이 올바른 attendance.html을 가리키는지 확인
2. 배포 URL과 페이지 경로 확인

---

## 📞 기술 문의
푸르메재단 넥슨어린이재활병원 재활치료센터
교육 담당자에게 문의하세요.
