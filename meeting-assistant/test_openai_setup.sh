#!/bin/bash

# Quick test for OpenAI API setup

echo "🧪 Testing OpenAI API Setup..."
echo ""

# Check if API key is set
if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ OPENAI_API_KEY is not set"
    echo ""
    echo "Set it with:"
    echo "  export OPENAI_API_KEY='your-api-key'"
    echo ""
    exit 1
fi

echo "✅ API key is set"
echo ""

# Test the Python script can import OpenAI
echo "Testing OpenAI package..."
source venv/bin/activate
python3 -c "from openai import OpenAI; print('✅ OpenAI package installed')" 2>/dev/null

if [ $? -ne 0 ]; then
    echo "❌ OpenAI package not installed"
    echo ""
    echo "Install it with:"
    echo "  source venv/bin/activate"
    echo "  pip install openai"
    exit 1
fi

# Test API connection
echo ""
echo "Testing API connection..."
python3 << EOF
from openai import OpenAI
import os

try:
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    # Try to list models to verify connection
    models = client.models.list()
    print("✅ API connection successful")
except Exception as e:
    print(f"❌ API connection failed: {e}")
    exit(1)
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 All tests passed! You're ready to use OpenAI API"
    echo ""
    echo "Run Remi with:"
    echo "  ./remi_controller"
else
    echo ""
    echo "❌ Tests failed. Check your API key and internet connection."
fi
