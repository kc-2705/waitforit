const mongoose = require('mongoose');

const { Schema } = mongoose;

// A store's listing of a product, as Channel3 returns it (simplified).
const offerSchema = new Schema(
  {
    domain: String,
    url: String,
    price: Number,
    compareAt: Number,
    currency: String,
    availability: String,
    condition: String,
  },
  { _id: false },
);

const productSchema = new Schema(
  {
    productId: { type: String, required: true },
    title: String,
    brand: String,
    image: String,
    features: [String],
    bestOffer: offerSchema,
    offerCount: Number,
    // Filled in by the AI when it sorts search results.
    fit: Number,
    reason: String,
  },
  { _id: false },
);

// One line in the agent's journal: everything it looked at and did, in plain words.
const eventSchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    kind: { type: String, enum: ['think', 'search', 'pay', 'check', 'drop', 'buy', 'wait', 'cancel', 'error'], default: 'think' },
    message: String,
  },
  { _id: false },
);

const wishSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    text: { type: String, required: true, maxlength: 500 },
    // What the AI understood from the wish.
    plan: {
      query: String,
      summary: String,
      brands: [String],
      mustHave: [String],
      avoid: [String],
      condition: { type: String, enum: ['new', 'any'], default: 'new' },
    },
    // The most the user will pay. PayPal holds exactly this much.
    maxPrice: { type: Number, required: true, min: 1, max: 10000 },
    status: {
      type: String,
      enum: ['choosing', 'needs_payment', 'watching', 'buying', 'bought', 'cancelled', 'expired'],
      default: 'choosing',
      index: true,
    },
    candidates: [productSchema],
    chosen: productSchema,
    // Lowest qualifying price seen at each check.
    prices: [{ _id: false, at: { type: Date, default: Date.now }, price: Number, domain: String, simulated: Boolean }],
    payment: {
      orderId: String,
      authorizationId: String,
      held: Number,
      expiresAt: Date,
      shipTo: String,
      captureId: String,
      paid: Number,
      released: Number,
      status: { type: String, enum: ['none', 'created', 'held', 'captured', 'voided'], default: 'none' },
      sample: Boolean,
    },
    purchase: {
      at: Date,
      price: Number,
      domain: String,
      url: String,
      saved: Number,
      reason: String,
      simulated: Boolean,
    },
    journal: [eventSchema],
    lastCheckedAt: Date,
  },
  { timestamps: true },
);

wishSchema.methods.log = function log(kind, message) {
  this.journal.push({ kind, message });
};

module.exports = mongoose.model('Wish', wishSchema);
