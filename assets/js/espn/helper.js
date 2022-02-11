import { get, toNumber } from 'lodash';
import { TeamData } from './static';
import { Player, Team } from "./";
import { eventMap, playerObject } from "./maps";

class EspnHelper {
  data = {};

  constructor(data) {
    this.data = data;
  }

  _g(path, defaultValue = undefined) {
    return get(this.data, path, defaultValue);
  }

  get request() {
    return this._g('request');
  }

  get leaders() {
    const categories = this.query('getLeaders');
    const leaders = [];
    const leaderRoster = {};

    for(let category of categories) {
      for(let leader of category.leaders) {
        const leaderObj = {}

        if(leaderRoster[leader.athlete.id]) break;
        else leaderRoster[leader.athlete.id] = true;

        leaderObj.team = this.getLeadersTeam(leader.team);
        leaderObj.player = this.newPlayer(leader.athlete);

        leaders.push(leaderObj);
      }
    }

    return leaders;
  }

  get team() {
    let query = this._g('getTeam');
    if(query === undefined) return null;

    let team = this._g(query);
    let t = {};
    let keys = ['id', 'location', 'name', 'abbreviation', 'color', 'alternateColor', 'logo', 'wins']

    _.each(keys, key => {
      switch(key) {
        case 'id':
          // For numbers
          t[key] = _.toNumber(team[key]);
          break;
        case 'alternateColor':
          t.alternateColor = !team.alternateColor ? TeamHelper.id(team.id, 'alternateColor') : team.alternateColor;
          break;
        case 'logo':
          t.logo = !team.logo ? team.logos[0].href : team.logo;
          break;
        case 'wins':
          if(team.recordSummary) {
            let record = team.recordSummary.split('-');
            t.wins = _.toNumber(record[0]);
            t.losses = _.toNumber(record[1]);
          } else if(team.record) {
            let record = team.record.items[0].stats;
            t.wins = _.toNumber(_.get(_.find(record, {name: 'wins'}), 'value', 0));
            t.losses = _.toNumber(_.get(_.find(record, {name: 'losses'}), 'value', 0))
          }
          break;
        default:
          // For strings or unknown.
          if(!team[key]) return;
          t[key] = team[key];
          break;
      }
    })
    return new Team(t);
  }

  get players() {
    const athletes = this.query('getPlayers');
    if(athletes === false) return this.player;

    let players = [];

    if(!athletes) return false;

    for(let athlete of athletes) {
      let player = this.newPlayer(athlete);
      if(!player) break;

      players.push(player);
    }

    return this.arraySingleOrFalse(players);
  }

  get player() {
    let athlete = this.query('getPlayer');
    if(athlete === false) return false;

    return this.newPlayer(athlete);
  }

  get games() {
    const gameData = this.query('getEvents');
    const statData = this.query('getStats');
    const regularSeasonStats = this.getSeasonType(statData.seasonTypes, 2)
    const returnObj = {};

    for(let event of regularSeasonStats.events) {
      let stats = {};
      for(let i in event.stats) {
        let name = statData.names[i];
        let displayName = statData.displayName[i];
        let value = event.stats[i];
        let stat = this.createState(name, displayName, value);
        stats[name] = stat;
      }
      returnObj[event.eventId] = stats;
    }

    console.log(returnObj);
  }

  getSeasonType(seasonTypes, typeRequesting) {
    for(let seasonType of seasonTypes) {
      for(let category of seasonType.categories) {
        if(toNumber(category.splitType) === typeRequesting) break;
        return category;
      }
    }
  }

  createState(name, displayName, value) {
    return { name, displayName, value }
  }

  query(query) {
    /** @var {string} */ let queryString = this._g(query);
    if(!queryString) return false;

    let queryArray = queryString.split(', ');
    const queryResults = this.runQueryRequests(queryArray);

    if(queryResults.length === 0) return false;

    switch(this.request) {
      case 'EspnApiFactory.Player.gamelog':
        const returnResults = {};
        queryArray.map((v, i) => {
          returnResults[v.replace('ESPN.', '')] = queryResults[i];
        })
        return returnResults;
      default:
        if(queryResults.length === 0) return false;
        if(queryResults.length === 1) return queryResults[0];
        return queryResults;
    }
  }

  runQueryRequests(requests) {
    const results = [];
    for(let request of requests) {
      let result = this._g(request);
      if(!result) {
        console.log(`Invalid query:  ${request}`);
        break;
      }

      results.push(result);
    }

    return results;
  }

  newPlayer(athlete) {
    let queries = this.playerQueries();
    let keys = playerObject(true);
    let obj = playerObject();

    for(let i in queries) {
      let key = keys[i];
      let query = queries[i];
      let value = this.getPlayerValue(key, query, athlete);

      if(value === undefined) break;
      obj[key] = value;
    }

    return new Player(obj);
  }

  getPlayerValue(key, query, athlete) {
    let isQueryArray = Array.isArray(query);
    let value = get(athlete, !isQueryArray ? query : query[0]);
    if(!value) return undefined;

    return !isQueryArray ? value : query[1](value);
  }

  playerQueries() {
    switch(this.request) {
      case 'EspnApiFactory.Player.id':
      case 'EspnApiFactory.Team.roster.1':
      case 'EspnApiFactory.Team.roster.2':
        return [
          ['id', toNumber],
          'fullName',
          'headshot.href',
          ['jersey', toNumber],
          'position.displayName',
          'weight',
          'height',
          'age'
        ]
      case 'EspnApiFactory.Player.leaders':
        return [
          ['id', toNumber],
          'fullName',
          'headshot.href',
          ['jersey', toNumber],
          'position.displayName'
        ]
      default:
        return false;
    }
  }

  getLeadersTeam(team) {
     let teamId = get(team, 'id');
     if(!teamId) {
       console.log(team);
       throw new Error('Leaders Team ID is missing.');
     }

     return TeamData.id(teamId);
  }

  arraySingleOrFalse(array) {
    if(array.length === 0) return false;
    if(array.length === 1) return array[0];
    return array;
  }
}

export { EspnHelper }
