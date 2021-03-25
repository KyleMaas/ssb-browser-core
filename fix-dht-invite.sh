#!/bin/bash
# Update multiserver-dht to version based on Hyperswarm.
sed -i 's/4.4.0/5.0.0/' node_modules/ssb-dht-invite/package.json
rm -rf node_modules/ssb-dht-invite/node_modules/multiserver-dht
