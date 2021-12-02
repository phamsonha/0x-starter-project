cd node_modules/@0x
mv contract-wrappers contract-wrappers1
mv migrations migrations1
mv contract-addresses contract-addresses1
mv order-utils order-utils1

ln -s /mnt/d/React/0x-prototol/protocol/packages/contract-wrappers contract-wrappers
ln -s /mnt/d/React/0x-prototol/protocol/packages/migrations migrations
ln -s /mnt/d/React/0x-prototol/protocol/packages/contract-addresses contract-addresses
ln -s /mnt/d/React/0x-prototol/protocol/packages/order-utils order-utils