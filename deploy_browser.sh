#!/bin/bash

set -e  # Exit immediately if a command exits with a non-zero status

# Configuration
IMAGE_NAME="supextension-browser"
CONTAINER_NAME="supextension-browser-container"
PORT_NOVNC_EXTERNAL=8081
PORT_NOVNC=8080
PORT_VNC=5900

echo "Starting deployment of Supextension Browser Extension with NoVNC..."

# Function to build new image
build_image() {
    echo "Checking if dist directory exists..."
    if [ ! -d "dist" ]; then
        echo "Error: dist directory not found. Please build the extension first."
        exit 1
    fi
    echo "Building new Docker image: $IMAGE_NAME"
    # Use host network to avoid DNS issues
    docker build --network=host -f Dockerfile.browser -t $IMAGE_NAME .
    echo "Image built successfully"
}

# Function to cleanup old container
cleanup_container() {
    echo "Cleaning up old container..."
    if [ "$(docker ps -aq -f name=$CONTAINER_NAME)" ]; then
        echo "Stopping old container: $CONTAINER_NAME"
        docker stop $CONTAINER_NAME || true
        echo "Removing old container: $CONTAINER_NAME"
        docker rm $CONTAINER_NAME || true
    else
        echo "No existing container found with name: $CONTAINER_NAME"
    fi
}

# Function to run the container
run_container() {
    echo "Running container: $CONTAINER_NAME"

    # Check if dist directory exists
    if [ ! -d "dist" ]; then
        echo "Error: dist directory not found. Please build the extension first."
        exit 1
    fi

    # Run the container with NoVNC enabled and mount the extension directory
    docker run -d \
        --name $CONTAINER_NAME \
        -v $(pwd)/dist:/opt/extension \
        -p $PORT_NOVNC_EXTERNAL:$PORT_NOVNC \
        -p $PORT_VNC:$PORT_VNC \
        $IMAGE_NAME

    echo "Container started successfully"
}

# Function to check if container is running
check_status() {
    echo "Waiting for container to be ready..."
    sleep 10

    # Check if container is running
    if [ ! "$(docker ps -q -f name=$CONTAINER_NAME)" ]; then
        echo "ERROR: Container failed to start!"
        docker logs $CONTAINER_NAME
        exit 1
    fi

    echo "Checking NoVNC accessibility..."
    # Check if NoVNC is responding
    if curl -s --head --request GET http://localhost:$PORT_NOVNC_EXTERNAL | grep "200 OK" > /dev/null; then
        echo "NoVNC is reachable!"
    else
        echo "WARNING: NoVNC might not be reachable yet. Status code:"
        curl -s --head --request GET http://localhost:$PORT_NOVNC_EXTERNAL | head -n 1
    fi

    echo "Browser extension container is running!"
    echo "NoVNC server available at: http://localhost:$PORT_NOVNC_EXTERNAL"
    echo "Traditional VNC server available at: localhost:$PORT_VNC"
    echo ""
    echo "To view logs: docker logs $CONTAINER_NAME"
    echo "To stop: docker stop $CONTAINER_NAME"
}

# Main deployment flow
main() {
    # Build first, then cleanup, to preserve image cache if build fails or is not needed
    build_image
    cleanup_container
    run_container
    check_status

    echo ""
    echo "Browser extension deployment completed successfully!"
    echo ""
    echo "Current running containers:"
    docker ps --filter name=$CONTAINER_NAME
}

# Run main function
main "$@"
