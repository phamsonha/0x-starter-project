cd node_modules/@0x
mv contract-wrappers contract-wrappers1
mv migrations migrations1
mv contract-addresses contract-addresses1
mv order-utils order-utils1

ln -s /Users/mac/Works/Solidity/0xProject/protocol/packages/contract-wrappers contract-wrappers
ln -s /Users/mac/Works/Solidity/0xProject/protocol/packages/migrations migrations
ln -s /Users/mac/Works/Solidity/0xProject/protocol/packages/contract-addresses contract-addresses
ln -s /Users/mac/Works/Solidity/0xProject/protocol/packages/order-utils order-utils