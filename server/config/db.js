const mongoose = require('mongoose');

async function connectDb(url) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(url);
  return mongoose.connection;
}

async function disconnectDb() {
  await mongoose.disconnect();
}

module.exports = { connectDb, disconnectDb };
