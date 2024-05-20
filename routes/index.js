var router = require('express').Router();
const GAME = require("../controllers/gameController");

// middlewares for routing the incoming requests

router.post('/add-team', GAME.addTeam);

router.post('/process-result', GAME.processResult);

router.get('/team-result', GAME.displayTeamResults);

module.exports = router;