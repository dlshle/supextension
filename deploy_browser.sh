#!/bin/bash

set -e  # Exit immediately if a command exits with a non-zero status

# Configuration
IMAGE_NAME="supextension-browser"
CONTAINER_NAME="supextension-browser-container"
PORT_VNC=5900

echo "Starting deployment of Supextension Browser Extension..."

# Function to cleanup old containers and images
cleanup_old() {
    echo "Cleaning up old containers and images..."

    # Stop and remove old container if it exists
    if [ "$(docker ps -aq -f name=$CONTAINER_NAME)" ]; then
        echo "Stopping old container: $CONTAINER_NAME"
        docker stop $CONTAINER_NAME || true
        echo "Removing old container: $CONTAINER_NAME"
        docker rm $CONTAINER_NAME || true
    else
        echo "No existing container found with name: $CONTAINER_NAME"
    fi

    # Remove old image if it exists
    if [ "$(docker images -q $IMAGE_NAME 2>/dev/null)" ]; then
        echo "Removing old image: $IMAGE_NAME"
        docker rmi -f $IMAGE_NAME || true
    else
        echo "No existing image found with name: $IMAGE_NAME"
    fi
}

# Function to build new image
build_image() {
    echo "Checking if dist directory exists..."
    if [ ! -d "dist" ]; then
        echo "Error: dist directory not found. Please build the extension first."
        exit 1
    fi
    echo "Building new Docker image: $IMAGE_NAME"
    docker build -f Dockerfile.browser -t $IMAGE_NAME . --no-cache
    echo "Image built successfully"
}

# Function to run the container
run_container() {
    echo "Running container: $CONTAINER_NAME"

    # Check if dist directory exists
    if [ ! -d "dist" ]; then
        echo "Error: dist directory not found. Please build the extension first."
        exit 1
    fi

    # Run the container with VNC enabled and mount the extension directory
    docker run -d \
        --name $CONTAINER_NAME \
        -v $(pwd)/dist:/opt/extension \
        -p $PORT_VNC:$PORT_VNC \
        -p 9222:9222 \
        $IMAGE_NAME

    echo "Container started successfully"
}

# Function to check if container is running
check_status() {
    echo "Waiting for container to be ready..."
    sleep 5

    # Check if container is running
    if [ ! "$(docker ps -q -f name=$CONTAINER_NAME)" ]; then
        echo "ERROR: Container failed to start!"
        docker logs $CONTAINER_NAME
        exit 1
    fi

    echo "Browser extension container is running!"
    echo "VNC server available at: localhost:$PORT_VNC"
    echo "Chrome remote debugging available at: localhost:9222"
    echo ""
    echo "To view logs: docker logs $CONTAINER_NAME"
    echo "To stop: docker stop $CONTAINER_NAME"
}

# Main deployment flow
main() {
    cleanup_old
    build_image
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