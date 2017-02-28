###### These steps are required
Install jspm:
    npm install jspm -g

Install serve:
    npm install -g serve

Install dependencies libs
	make install-libs


###### These steps are optional
Build QA environment:
	make build-qa
run QA environment (port 9001):
	make run-qa

Build production environment:
	make build-prod
Run production environment (port 9009):
	make run-prod
