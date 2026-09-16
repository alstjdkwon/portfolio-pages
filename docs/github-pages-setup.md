# GitHub Pages 초기 게시

이 프로젝트는 별도 서버 없이 GitHub Actions가 PDF를 PNG로 변환하고 GitHub Pages에 정적
페이지를 게시합니다. 현재 등록된 첫 공개 경로는 `/portfolio-v1`입니다.

## 저장소 설정

1. 이 폴더를 본인의 **public** GitHub 저장소에 push합니다. GitHub Free에서는 public 저장소의
   Pages를 사용해야 합니다.
2. 저장소의 **Settings → Pages → Build and deployment → Source**를 `GitHub Actions`로
   설정합니다.
3. **Settings → Secrets and variables → Actions → Variables**에 다음 두 값을 추가합니다.

   - `PORTFOLIO_OWNER_LOGIN`: 저장소 소유자의 GitHub 로그인 이름
   - `CLARITY_PROJECT_ID`: Microsoft Clarity 프로젝트의 ID

   `CLARITY_PROJECT_ID`가 비어 있으면 로컬 빌드는 성공하지만 방문 기록은 수집되지 않습니다.
   실제 공유 전에 반드시 Clarity ID를 설정해야 합니다.

저장소에 첫 커밋을 만든 뒤 `portfolio/manifest.json`의 `portfolio-v1.sourceRef`를 PDF가
추가된 커밋의 40자리 SHA로 맞춥니다. 이 작업공간은 아직 해당 파일들을 커밋하지 않았기
때문에 현재 값은 로컬 기준 커밋을 가리킵니다.

## 첫 게시

1. Actions 탭에서 `Publish portfolio Pages`를 선택하고 **Run workflow**를 누릅니다.
2. `publish_mode`를 `bootstrap`으로 선택하고 `bootstrap_pdf`에 다음 경로를 입력합니다.

   ```text
   docs/portfolio-v1.pdf
   ```

3. 실행 요약의 `published` 항목에 표시되는 Pages URL을 PC 검증용으로 사용합니다. 예상
   경로는 `https://<계정>.github.io/<저장소>/portfolio-v1/`입니다.

Actions가 `processing`인 동안에는 새 링크가 없으며, 변환·검증·Pages 배포가 실패하면
`failed`만 표시되고 기존 Pages 게시본은 유지됩니다.

## 초기 PC 검증 후 반복 게시 활성화

현재 매니페스트는 `verificationStatus: "not_started"`와
`repeatingPublishEnabled: false`로 잠겨 있습니다. 다음 네 가지를 모두 확인한 뒤에만
소유자가 `portfolio/manifest.json`의 두 값을 각각 `passed`, `true`로 변경하고 push합니다.

- 23쪽의 순서·비율·글자·이미지가 원본 PDF와 일치합니다.
- Desktop Chrome, 1440×900, 빈 캐시, Lighthouse 데스크톱 모드 3회 중앙값에서 첫 페이지가
  3초 이내에 표시됩니다.
- 처음부터 끝까지 스크롤해 페이지 겹침이나 위치 튐이 없습니다.
- Clarity에서 실제 테스트 방문과 스크롤·체류 시간 히트맵을 확인했습니다.

그 후 새 PDF는 새 `version.id`와 새 `route.path`로 추가합니다. 기존 경로의 버전 항목은
수정하거나 삭제하지 않으며, 같은 버전에 여러 회사 경로를 추가할 수 있습니다. 각 버전의
`sourceRef`는 해당 PDF가 저장소에 추가된 커밋의 40자리 SHA를 기록해야 합니다.
