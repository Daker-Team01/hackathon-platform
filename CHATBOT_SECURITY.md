# 🔐 챗봇 보안 & 배포 가이드 (Groq 무료 LLM)

## 📋 현재 구조

```
Frontend (Vite/React)
    ↓ (fetch '/api/chatbot')
Backend (Vercel Serverless)
    ↓ (Groq API - 무료!)
Groq API (mixtral-8x7b-32768)
```

**보안 특징:**
- ✅ API 키는 **서버에만** 존재 (프론트엔드에서 절대 노출 됨)
- ✅ `.env.local`은 git에 추적되지 않음 (`.gitignore`에 `*.local` 포함)
- ✅ 프론트엔드는 민감한 정보 미소유
- ✅ **완전 무료** (Groq API 사용)

---

## 💰 Groq 무료 버전 정보

| 항목 | 설명 |
|------|------|
| **비용** | 🆓 완전 무료 |
| **모델** | mixtral-8x7b-32768, llama-3 등 |
| **응답 속도** | OpenAI보다 빠름 ⚡ |
| **제한** | 시간당 30 요청 (충분함) |
| **배포** | Vercel 호환 ✅ |

---

## 🚀 Groq 무료 API 키 발급

### 1. Groq 계정 생성
https://console.groq.com/keys 에서:
1. 회원가입
2. API 키 생성
3. 키 복사

### 2. Vercel에서 환경변수 설정

**Vercel Dashboard**에서:
1. **Settings** → **Environment Variables**로 이동
2. 다음 변수 추가:
   ```
   Name: GROQ_API_KEY
   Value: gsk_your-actual-groq-api-key
   ```
3. **Production**, **Preview**, **Development** 모두 체크
4. 저장 후 재배포

---

## 🌐 로컬 개발

### 1. Groq API 키 설정
`.env.local`에 추가 (git 무시됨):
```env
# 로컬 개발용 (선택사항)
GROQ_API_KEY=gsk_your-test-key
```

### 2. 로컬 서버 실행
```bash
npm run dev
```

---

## ⚙️ 수정된 파일

```diff
/api/chatbot.ts
- import OpenAI from 'openai'
+ import Groq from 'groq-sdk'

- const openai = new OpenAI({ apiKey })
+ const groq = new Groq({ apiKey })

- model: 'gpt-3.5-turbo',
+ model: 'mixtral-8x7b-32768',

- const apiKey = process.env.OPENAI_API_KEY
+ const apiKey = process.env.GROQ_API_KEY
```

---

## 🔒 보안 체크리스트

- [ ] `.env.local`이 git에 커밋되지 않았는가?
- [ ] `api/chatbot.ts`에 Groq API 키가 하드코딩되지 않았는가?
- [ ] Vercel에서 `GROQ_API_KEY` 환경 변수가 설정되었는가?
- [ ] 프론트엔드에서 API 키를 사용하지 않는가?
- [ ] `.gitignore`에 `*.local`이 포함되어 있는가?

---

## 🐛 문제 해결

### "API 키 인증 실패" 에러
```
해결:
1. Groq 계정에서 API 키 재확인
2. Vercel에서 GROQ_API_KEY 설정 확인
3. 편집 후 재배포 (git push)
```

### "시간당 제한 초과" 에러
```
해결:
- Groq 무료판은 시간당 ~30 요청
- 캐시 구현 고려
- Groq Pro 가입 (유료)
```

### 로컬에서 작동하지 않음
```bash
npm install groq-sdk    # 설치 확인
npm run dev             # 개발 서버 시작
# 브라우저 콘솔에서 에러 확인
```

---

## 📚 참고 자료

- [Groq API 문서](https://console.groq.com/docs)
- [Vercel Serverless Functions](https://vercel.com/docs/functions/serverless-functions)
- [Groq 사용 가능한 모델](https://console.groq.com/docs/models)
