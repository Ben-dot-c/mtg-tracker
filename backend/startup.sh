#!/bin/bash
cd /home/site/wwwroot
PACKAGES=/home/site/packages
if [ ! -d "$PACKAGES/uvicorn" ]; then
    pip3 install -r requirements.txt --target $PACKAGES
fi
export PYTHONPATH=$PACKAGES
exec python3 -m uvicorn main:app --host 0.0.0.0 --port 8000
