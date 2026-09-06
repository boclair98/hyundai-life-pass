# 우주 × 자동차 비주얼 개편

기능 구성은 유지하고 첫 화면만 몰입형 비주얼로 확장했습니다. 스크롤 프레임 축소, 8초 배경 전환, 수동 선택·일시정지, 화면 밖/비활성 탭 자동 정지, 동작 줄이기 설정을 지원합니다. 충전 지도에는 긴 장면을 추가하지 않습니다.

## 생성 출처와 저장 경로

내장 이미지 생성 도구(built-in image_gen)로 새로 만든 AI 콘셉트 이미지입니다. 실제 차량 상태·시설·공식 현대 서비스의 촬영 사진이 아닙니다. 생성 원본은 유지하고 WebP로 인코딩했습니다.

- `public/orbit/orbit-hero-v1-800.webp`
- `public/orbit/orbit-hero-v1-1536.webp`

### orbit-hero-v1 최종 프롬프트

Use case: stylized-concept. Asset type: cinematic automotive website hero background, landscape 1536x1024. Primary request: a spectacular yet refined fusion of Hyundai-inspired electric motoring and aerospace. A silver angular electric crossover with the distinctive clean proportions and pixel lamps of an IONIQ 5, parked on a dark basalt overlook; huge softly illuminated Earth rising over the lunar horizon. Photorealistic high-end automotive campaign, elegant believable bodywork, deep Hyundai navy, glacier blue rim light, subtle stars, luminous atmosphere. Car fully visible in lower central-right portion; upper half and left third uncluttered dark navy negative space for website text, with clear silhouette that survives portrait crop. No people, rockets, UI, typography, watermark or official branding claims. Not a collage. Beautiful restrained material reflections; blue rather than orange or purple.

- `public/orbit/orbit-charge-v1-800.webp`
- `public/orbit/orbit-charge-v1-1536.webp`

### orbit-charge-v1 최종 프롬프트

Use case: stylized-concept. Asset type: cinematic automotive feature background, landscape 1536x1024. Primary request: a silver Hyundai IONIQ-5-inspired angular electric crossover connected with a physically plausible cable to a sculptural minimal EV charger on a moon observatory terrace, Earth and delicate blue atmosphere beyond panoramic glass. Luxurious futuristic but uncluttered architectural automotive photography. The entire vehicle and charger visible, positioned lower right; expansive midnight blue negative space left and upper. Frosted silver, Hyundai navy, pale cyan lighting, clean graphite floor and realistic reflections. No writing, no HUD, no logos, no people, no watermark. Show an imaginative concept environment, not a real charging location. One coherent frame, cinematic realism.

- `public/orbit/orbit-road-v1-800.webp`
- `public/orbit/orbit-road-v1-1536.webp`

### orbit-road-v1 최종 프롬프트

Use case: stylized-concept. Asset type: cinematic automotive website feature background, landscape 1536x1024. Primary request: silver Hyundai IONIQ-5-inspired electric crossover in rear three-quarter view driving along a beautiful sweeping coastal road under an immense starry blue night sky; distant curve of a planet seamlessly evokes an aerospace journey. Realistic luxury automotive campaign photo, natural road geometry, understated pixel rear lights, motion blur only on road, crisp car. Car lower central-right, spacious darker navy upper-left for website headings. Beautiful soft moonlit sea, silver and deep Hyundai blue palette, hints of dawn white glow. No people, city billboards, rockets, science-fiction HUD, text, watermark, or logos. Sophisticated, quiet wonder rather than noisy cyberpunk.

- `public/orbit/orbit-care-v1-800.webp`
- `public/orbit/orbit-care-v1-1536.webp`

### orbit-care-v1 최종 프롬프트

Use case: stylized-concept. Asset type: premium vehicle-care feature image, landscape 1536x1024. Primary request: a precise silver Hyundai IONIQ-5-inspired electric crossover inside a serene futuristic automotive inspection atelier, side three-quarter view, clean circular white ceiling light reflected in bodywork and a deep navy panoramic window revealing Earth and stars. Premium photorealistic advertising, beautiful car proportions, four realistic wheels with detailed tires, subtle blue rim light, tidy graphite architecture. Vehicle occupies lower right, generous quiet upper-left space for website text. Palette midnight Hyundai navy, titanium silver, pale cyan. No people, tools floating in air, diagnostic text, screens with numbers, HUD, logos or watermark. This is aspirational concept imagery, not a claim of actual diagnostic capability.

## 확인 범위

기존 차량 연결, 관리 기록, 충전소·정비소 조회 로직은 변경하지 않았습니다.

- 320px·390px·1440px 폭: 가로 넘침 없음, 홈 바로가기 6개 유지.
- 스크롤 380px: 프레임 inset 2.57%, 모서리 약 25.7px, 배경 배율 약 1.012로 변화 확인.
- 배경 수동 선택 시 자동 전환 정지, 재생 시 장면 변경 확인.
- 홈 → 충전: 실제 충전소 30곳 응답 표시. 로컬은 지도 키가 없으므로 지도는 운영 배포에서 확인.
- 홈 → 주차 위치: 기존 드라이브 주차 탭으로 이동 확인.
- 브라우저 콘솔 오류·경고 없음, 조회 재시도 회귀 테스트 4개 통과.
- 동작 줄이기는 코드·스타일 적용 경로를 검토했으며 기기 설정을 바꾸는 별도 실기기 검사는 하지 않음.
- 이미지 8개(4장 × 2해상도) 총 598,816바이트. 생성은 내장 도구, 파일 최적화는 그림을 변경하지 않는 WebP 재인코딩.
