const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
  },
  { timestamps: true },
);

userSchema.methods.toPublic = function toPublic() {
  return { id: this._id.toString(), name: this.name, email: this.email, createdAt: this.createdAt };
};

module.exports = mongoose.model('User', userSchema);
