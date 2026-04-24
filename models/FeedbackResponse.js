const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  answer: {
    type: String, // Can be "Yes"/"No", text, or option selected
    required: true,
  },
});

const feedbackResponseSchema = new mongoose.Schema({
  formId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeedbackForm',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  answers: {
    type: [answerSchema],
    required: true,
  },
}, { timestamps: true });

// Ensure a user can only respond once per form
feedbackResponseSchema.index({ formId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('FeedbackResponse', feedbackResponseSchema);
