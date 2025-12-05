#!/bin/bash

set -e  # Exit immediately if a command exits with a non-zero status

# Configuration
IMAGE_NAME="supextension-puppet"
CONTAINER_NAME="supextension-puppet-container"
PORT_WS=9222
PORT_HTTP=9223

echo "Starting deployment of Supextension Puppet Server..."

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
    echo "Building new Docker image: $IMAGE_NAME"
    docker build -t $IMAGE_NAME . --no-cache
    echo "Image built successfully"
}

# Function to run the container
run_container() {
    echo "Running container: $CONTAINER_NAME"
    
    # Run the container with default configuration
    docker run -d \
        --name $CONTAINER_NAME \
        -p $PORT_WS:$PORT_WS \
        -p $PORT_HTTP:$PORT_HTTP \
        -e PUPPET_HOST=0.0.0.0 \
        -e PUPPET_PORT=$PORT_WS \
        -e PUPPET_HTTP_PORT=$PORT_HTTP \
        -e PUPPET_HTTP_ENABLED=true \
        $IMAGE_NAME
    
    echo "Container started successfully"
}

# Function to check if container is running and healthy
check_health() {
    echo "Waiting for container to be ready..."
    sleep 10
    
    # Check if container is running
    if [ ! "$(docker ps -q -f name=$CONTAINER_NAME)" ]; then
        echo "ERROR: Container failed to start!"
        docker logs $CONTAINER_NAME
        exit 1
    fi
    
    # Wait a bit more and then check health endpoint
    sleep 5
    echo "Checking health endpoint..."
    
    # Test the health endpoint using docker exec instead of external curl
    HEALTH_STATUS=$(docker exec $CONTAINER_NAME wget -qO- http://localhost:9223/health 2>/dev/null || echo '{"status":"error"}')
    echo "Health check response: $HEALTH_STATUS"
    
    if [[ "$HEALTH_STATUS" == *"\"status\":\"ok\""* ]]; then
        echo "Service is healthy!"
        echo "Puppet Server is running:"
        echo "  WebSocket: ws://localhost:$PORT_WS"
        echo "  HTTP Health: http://localhost:$PORT_HTTP/health"
        echo ""
        echo "To view logs: docker logs $CONTAINER_NAME"
        echo "To stop: docker stop $CONTAINER_NAME"
    else
        echo "WARNING: Service may not be healthy. Check logs:"
        docker logs $CONTAINER_NAME
    fi
}

# Main deployment flow
main() {
    cleanup_old
    build_image
    run_container
    check_health
    
    echo ""
    echo "Deployment completed successfully!"
    echo ""
    echo "Current running containers:"
    docker ps --filter name=$CONTAINER_NAME
}

# Run main function
main "$@"