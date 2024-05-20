const playersJsonArray = require("../data/players.json");
const matchJsonArray = require("../data/match.json");
const Teams = require("../models/teams");
const fs = require("fs");

module.exports = class GAME {

    // GET all Teams Results ordered by decreasing points scored.
    static async displayTeamResults(req, res) {
        try {
            // here lean is used to add the position field in the results.
            const teams = await Teams.find().select('teamName totalPoints -_id').sort({totalPoints: -1}).lean();
            teams[0].position = "Winner";
            let ranking = 2;
            for(let i = 1; i < teams.length;i++) {
                if(teams[i].totalPoints === teams[i-1].totalPoints) {
                    teams[i].position = teams[i-1].position;
                } else {
                    teams[i].position = ranking;
                    ranking++;
                } 
            }
            
            res.status(200).json(teams);
        } catch(err) {
            res.status(404).json({ message: err.message });
        }
    }

    // Add a team
    static async addTeam(req, res) {
        let allowedPlayerTypes = {
            "ALL-ROUNDER": 0,
            "WICKETKEEPER": 0,
            "BOWLER": 0,
            "BATTER": 0
        };
        
        let playerCountInTeams = {
            "Rajasthan Royals": 0,
            "Chennai Super Kings": 0
        };

        const team = req.body;
        const teamName = team.teamName;
        const players = team.players;
        const captain = team.captain;
        const viceCaptain = team.viceCaptain;
        const totalPoints = 0;

        // Assuming that the player names are coming from UI side so won't be having spelling errors.
        if(!teamName) {
            res.status(400).send({ message: "Please enter a team name" });
        } else if(!players || !players.length || players.length !== 11) {
            res.status(400).send({ message: "Please enter 11 team players" });
        } else if(!captain) {
            res.status(400).send({ message: "Please enter your team captain" });
        } else if(!viceCaptain) {
            res.status(400).send({ message: "Please enter your team vice-captain" });
        } else {
            
            for(let player of players) {
                const playerObject = playersJsonArray.filter(obj => Object.values(obj).some(val => val.includes(player)))[0];
                playerCountInTeams[playerObject.Team]++;
                allowedPlayerTypes[playerObject.Role]++;
            }
            for(let teams in playerCountInTeams) {
                if(playerCountInTeams[teams] > 10 || playerCountInTeams[teams] < 1) {
                    return res.status(400).send({ message: "Please select at most 10 players from a single team" });
                }
            }

            for(let playerType in allowedPlayerTypes) {
                if(allowedPlayerTypes[playerType] > 8 || allowedPlayerTypes[playerType] < 1) {
                    return res.status(400).send({ message: `Please select number of ${playerType} players between 1 and 8.` });
                }
            }
        }

        try {
            team.totalPoints = totalPoints;
            await Teams.create(team);
            res.status(201).send({ message: 'Team created successfully!' });
        } catch (err) {
            res.status(400).send({ message: err.message });
        }
        
    }

    // Process the match results and award points accordingly to respective teams.
    static async processResult(req, res) {
        for(let playerEntry in playersJsonArray) {
            playersJsonArray[playerEntry].playerPoints = 0;
            playersJsonArray[playerEntry].runs = 0;
            playersJsonArray[playerEntry].wickets = 0;
            playersJsonArray[playerEntry].catches = 0;
        }

        let totalDotsPerOver = 0;
        let extraBallsBowledInAnOver = 0;

        for(let ballEntry in matchJsonArray) {
            let currentBallStats = matchJsonArray[ballEntry];
            const currentBatter = currentBallStats.batter;
            const currentNonStriker = currentBallStats["non-striker"];
            const batsmanRuns = currentBallStats.batsman_run;
            const totalRunsPerBall = currentBallStats.total_run;
            const isWicketDelivery = currentBallStats.isWicketDelivery;
            const playerOut = currentBallStats.player_out;
            const kind = currentBallStats.kind;
            const inningNumber = currentBallStats.innings;
            const overNumber = currentBallStats.overs;
            const ballNumber = currentBallStats.ballnumber;
            const extraRuns = currentBallStats.extras_run;
            const extraType = currentBallStats.extra_type;

            let batterObject = playersJsonArray.filter(obj => Object.values(obj).some(val => val.toString().includes(currentBatter)))[0];
            const nonStrikerObject = playersJsonArray.filter(obj => Object.values(obj).some(val => val.toString().includes(currentNonStriker)))[0];

            const currentBowler = currentBallStats.bowler;
            const bowlerObject = playersJsonArray.filter(obj => Object.values(obj).some(val => val.toString().includes(currentBowler)))[0];

            const currentFieldersInvolved = currentBallStats.fielders_involved;
            const fielderObject = playersJsonArray.filter(obj => Object.values(obj).some(val => val.toString().includes(currentFieldersInvolved)))[0];            

            // Award points for Runs
            if(batsmanRuns) {
                batterObject.runs += batsmanRuns;
                batterObject.playerPoints += batsmanRuns;
                if(batsmanRuns === 4) {
                    batterObject.playerPoints += 1;
                } else if(batsmanRuns === 6) {
                    batterObject.playerPoints += 3;
                }
            }

            // logic to check for a maiden over
            if(!totalRunsPerBall) {
                if(inningNumber === 1 && overNumber === 0 && ballNumber === 1) {
                    totalDotsPerOver = 1;
                } else if(inningNumber === matchJsonArray[ballEntry - 1].innings && overNumber === matchJsonArray[ballEntry - 1].overs) {
                    if(ballNumber === 0) {
                        totalDotsPerOver = 1;
                    } else {
                        totalDotsPerOver++;
                    }
                }
            } else {
                if(extraRuns) {
                    if(extraType === "wides") {
                        extraBallsBowledInAnOver++;
                    }
                }
            }

            // Award maiden over points
            if(ballNumber === 6 && totalDotsPerOver === 6) {
                bowlerObject.playerPoints += 12;
                totalDotsPerOver = 0;
                extraBallsBowledInAnOver = 0;
            } else if(ballNumber === (6 + extraBallsBowledInAnOver)) {
                totalDotsPerOver = 0;
                extraBallsBowledInAnOver = 0;
            }

            // Award points for wickets and fielding
            if(isWicketDelivery) {
                if((playerOut === currentBatter) && (batterObject.runs === 0) && 
                (batterObject.Role === "BATTER" || batterObject.Role === "WICKETKEEPER" || batterObject.Role === "ALL-ROUNDER")) {
                    batterObject.playerPoints -= 2;
                } else if((playerOut === currentNonStriker) && (nonStrikerObject.runs === 0) && 
                (batterObject.Role === "BATTER" || batterObject.Role === "WICKETKEEPER" || batterObject.Role === "ALL-ROUNDER")){
                    nonStrikerObject.playerPoints -= 2;
                }
            
                if(kind !== "runout") {
                    bowlerObject.playerPoints += 25;
                    bowlerObject.wickets += 1;
                    if(kind === "caught and bowled") {
                        bowlerObject.playerPoints += 8;
                        bowlerObject.catches += 1;
                    } else if(kind === "lbw" || kind === "bowled") {
                        bowlerObject.playerPoints += 8;
                    } else if(kind === "caught") {
                        fielderObject.playerPoints += 8;
                        fielderObject.catches += 1;
                    } else {
                        fielderObject.playerPoints += 12; // Stumping points
                    }
                } else {
                    fielderObject.playerPoints += 6; // runout points
                }
            
            }

        }    
        
        // Award bonus points for landmark runs, wickets and catches here
        for(let player of playersJsonArray) {               
            if(player.runs >= 30 && player.runs < 50) {
                player.playerPoints += 4;
            } else if(player.runs >= 50 && player.runs < 100) {
                player.playerPoints += 8;
            } else if(player.runs >= 100) {
                player.playerPoints += 16 * Math.floor(player.runs / 100);
                let remainderRuns = player.runs % 100;
                if(remainderRuns >= 30 && remainderRuns < 50) {
                    player.playerPoints += 4;
                } else if(remainderRuns >= 50 && remainderRuns < 100) {
                    player.playerPoints += 8;
                }
            }

            if(player.wickets >= 5) {
                player.playerPoints += 16 * Math.floor(player.wickets / 5);
                let remainderWickets = player.wickets % 5;
                if(remainderWickets === 4) {
                    player.playerPoints += 8;
                } else if(remainderWickets === 3) {
                    player.playerPoints += 4;
                }
            } else if(player.wickets === 4) {
                player.playerPoints += 8;
            } else if(player.wickets === 3) {
                player.playerPoints += 4;
            }

            if(player.catches >= 3) {
                player.playerPoints += 4 * Math.floor(player.catches / 3);
            }

        }

        // find and update the totalPoints for every team
        try {
            const teamEntries = await Teams.find({});
            
            for(const individualTeam of teamEntries) {
                let playersArray = individualTeam.players;
                let captain = individualTeam.captain;
                let viceCaptain = individualTeam.viceCaptain;
                let cumulativeTeamPoints = individualTeam.totalPoints;

                playersArray.forEach(teamPlayer => {
                    let playerObject = playersJsonArray.filter(obj => Object.values(obj).some(val => val.toString().includes(teamPlayer)))[0];
                    if(teamPlayer === captain) {
                        cumulativeTeamPoints += playerObject.playerPoints * 2;
                    } else if(teamPlayer === viceCaptain) {
                        cumulativeTeamPoints += playerObject.playerPoints * 1.5;
                    } else {
                        cumulativeTeamPoints += playerObject.playerPoints;
                    }                    
                });

                await Teams.updateOne({"teamName": individualTeam.teamName}, {"totalPoints": cumulativeTeamPoints});

            }

            res.status(201).json({ message: "Match results processed successfully!" });
        } catch (err) {
            res.status(404).json({ message: err.message });
        }

    }

};