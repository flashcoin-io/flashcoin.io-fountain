install-libs:
	jspm install
build-qa:
	cp scripts/setting/Setting-qa.js scripts/setting/Default.js
	jspm bundle-sfx scripts/start.js public/dist/unity-sdk.js
run-qa:
	serve -p 9001
build-prod:
	cp scripts/setting/Setting-prod.js scripts/setting/Default.js
	jspm bundle-sfx scripts/start.js public/dist/unity-sdk.js
run-prod:
	serve -p 9009
