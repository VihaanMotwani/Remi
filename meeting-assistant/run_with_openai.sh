#!/bin/bash

# Remi - Run with OpenAI API
# This script sets up the OpenAI API key and runs the controller

# Check if API key is already set
if [ -z "$OPENAI_API_KEY" ]; then
    echo "🔑 OpenAI API key not found in environment"
    echo ""
    echo "Please enter your OpenAI API key:"
    echo "(Get one at: https://platform.openai.com/api-keys)"
    read -s OPENAI_API_KEY
    export OPENAI_API_KEY
    echo ""
fi

# Verify API key is set
if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ No API key provided. Exiting."
    exit 1
fi

echo "✅ OpenAI API key configured"
echo "🚀 Starting Remi Controller..."
echo ""

# Run the controller
./remi_controller
