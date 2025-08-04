set -e  # Stop on any error

CI_REGISTRY="repo.hsenidmobile.com"
DOCKER_IMAGE_DOMAIN="charactor-bot/da-automation-tests"
GIT_TAG="$1"
#GIT_TAG=$(git describe)

HMS_REPO_SPROUTE_REGISTRY_USER="robot\$charactor-bot+sproute_charactor_bot" #"\"before "$charactor" to confuse avoiding bash
HMS_REPO_SPROUTE_REGISTRY_PWD="bgaYeKWGSHAQGsc2a21ycBrSVZad8CHk"

IMAGE_NAME="${CI_REGISTRY}/${DOCKER_IMAGE_DOMAIN}:${GIT_TAG}"

echo " Building Docker image: $IMAGE_NAME"
docker build --no-cache -t "$IMAGE_NAME" .

echo " Logging into Docker registry: $CI_REGISTRY"
docker login "$CI_REGISTRY" -u "$HMS_REPO_SPROUTE_REGISTRY_USER" -p "$HMS_REPO_SPROUTE_REGISTRY_PWD"

echo " Pushing image to registry..."
docker push "$IMAGE_NAME"

echo " Done: $IMAGE_NAME pushed successfully."


##package.json line
#"pretest": "rm -rf ./test-results/* && rm -rf ./src/helper/report/test-duration.txt && node -e \"require('fs').writeFileSync('start-time.txt', Date.now().toString())\"",

