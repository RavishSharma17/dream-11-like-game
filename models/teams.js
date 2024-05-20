const mongoose = require("mongoose");

const teamSchema = mongoose.Schema({
    teamName: {
        type: String,
        required: true,
        unique: [true, 'The team name already exits, please try again with a new team name']
    },
    players: {
        type: [String],
        required: true
    },
    captain: {
        type: String,
        required: true
    },
    viceCaptain: {
        type: String,
        required: true
    },
    totalPoints: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model('teams', teamSchema);