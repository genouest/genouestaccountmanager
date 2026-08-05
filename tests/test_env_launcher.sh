#!/bin/bash

# You can modify these variables if necessary
MYDIR=$(pwd)
MY_ADMIN_EMAIL=admin@my.org
MY_ADMIN_PASSWORD=admin

# The script have two types of methods : quick and full
# - Quick method allows to quickly test change made inside the test file.
# - Full method use act to run the github actions like it will runs after the push on GitHub
# The quick method is useful to run while your are doing the dev of your test.
# Once the test is ready, it is useful to run the full method before pushing to the repo.
test_type="${1:-full}"

if ! [ "$(basename "$PWD")" = "tests" ]; then
    echo "Please launch this script from the genouestaccountmanager/tests folder."
	exit 1
fi

if ! [ -f ".env" ]; then
	echo "Creating .env file..."
	printf "MYDIR=%s\nMY_ADMIN_EMAIL=%s\nMY_ADMIN_PASSWORD=%s\n" "$MYDIR" "$MY_ADMIN_EMAIL" "$MY_ADMIN_PASSWORD" > .env
	echo ".env file created !"
else
	echo ".env file found !"
fi

if [ -d "./home_dir" ] || [ -d "./cron" ]; then
	echo "Folder from previous tests still exists. Deleting these folders..."
	sudo rm -r ./home_dir ./cron
	echo "Old folders deleted !"
fi

if [ "$test_type" == "quick" ]; then
	echo "Launching dockers..."
	if sudo docker compose up -d; then
		echo "Dockers started !"
	else
		echo "Dockers starting failed..."
		exit 1
	fi
	cd ..
	echo "Waiting for the services to launch..."
	sleep 12
	while true; do
		echo "Launching tests..."
		mocha -t 20000
		echo "Tests results above !"
		echo "Press Enter to relaunch a test or press q to stop test environment."
		read -s key
		if [ "$key" == "q" ]; then
			echo "Stopping test environment..."
			break
		fi
	done
	cd ./tests
	echo "Stopping dockers..."
	sudo docker compose down  >/dev/null 2>&1
	echo "Dockers stopped !"
	echo "Deleting test folders..."
	sudo rm -r ./home_dir ./cron
	echo "Test folders deleted !"
	echo "Test environment stopped !"
else
	if ! [ -f "./local_testing/act/bin/act" ]; then
		echo "act not installed on the repo. Installing act..."
		curl --proto '=https' --tlsv1.2 -sSf https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash
		sudo mv ./bin/ ./local_testing/act/
		if ! [ -f "./local_testing/act/bin/act" ]; then
			echo "act installed on the repo !"
		else
			echo "act installation failed..."
		fi
	else
		echo "act installation found !"
	fi

	echo "Building docker image for local runner..."
	if sudo docker build -t act_runner_local_tests -f local_testing/Dockerfile .; then
		echo "Docker image for local runner built !"
	else
		echo "Docker build failed..."
		exit 1
	fi

	echo "Launching github action test.yml..."
	cd ..
	sudo ./tests/./local_testing/act/act --env GITHUB_REPOSITORY=genouest/genouestaccountmanager --pull=false --bind -P self-hosted=act_runner_local_tests -W '.github/workflows/test.yml'
	echo "Test finished, results above!"
fi