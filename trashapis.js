var apiList = [];
var http = require('http');
var request = require('request');
var cheerio = require('cheerio');

function afvalapp(postcode, homenumber, country, callback){

  		var options = {
  			host: 'dataservice.deafvalapp.nl',
  			path: '/dataservice/DataServiceServlet?type=ANDROID&service=OPHAALSCHEMA&land=' +
  			country + '&postcode=' + postcode + '&straatId=0&huisnr=' + homenumber + '&huisnrtoev='
  		};

  		var req = http.get(options,(res)=>{
  			var dates = {};
  			var curr = '';
  			var data = '';

  			res.on('data',function(chunk){

  				data += chunk;

  			});

  			res.on('end', ()=>{

  			var respArray = data.toString().split('\n').join('').split(";");
  				respArray.pop();
  				for(var i in respArray){
  					if(isNaN(parseInt(respArray[i])))
  					{
  						dates[respArray[i]] = [];
  						curr = respArray[i];
  					}
  					else{
  						dates[curr].push(respArray[i]);
  					}
  				}

  				if(Object.keys(dates).length === 0 && dates.constructor === Object){
  					Homey.log('Invalid input');
  					return callback(null,{});

  				}else{//validate the response

  					return callback(null,{});


  				}

  			});
  		});

  		req.on('error', function (err){
  				Homey.log(err.message);
  		});
}

function mijnAfvalWijzer(postcode, housenumber, country, callback){
  var dates = {REST:
   [ '29-12-2016',
     '01-12-2016',
     '03-11-2016',
     '06-10-2016',
     '08-09-2016',
     '11-08-2016',
     '14-07-2016',
     '16-06-2016',
     '19-05-2016',
     '21-04-2016',
     '24-03-2016',
     '25-02-2016',
     '28-01-2016' ]};

  var fDates = {};
  if(country !== "NL"){
    console.log('unsupported country');
    callback(null,false);
  }
  var options = {
    host:'www.mijnafvalwijzer.nl',
    path:'nl/3825AL/41/'
  };

  request('http://www.mijnafvalwijzer.nl/nl/3571VG/7/', function(err, res, body){

    if(!err && res.statusCode == 200){
      //console.log(res);
      var $ = cheerio.load(res.body);
      $('a.wasteInfoIcon p').each((i, elem)=>{
        var dateStr = parseDate(elem.children[0].data);
        //console.log(elem.attribs.class);
        switch (elem.attribs.class) {
          case 'gft':
            if(!fDates.GFT) fDates.GFT = [];
            fDates.GFT.push(dateStr);
            break;
          case 'papier':
            if(!fDates.PAPIER) fDates.PAPIER = [];
            fDates.PAPIER.push(dateStr);
            break;
          case 'restafval':
            if(!fDates.REST) fDates.REST = [];
            fDates.REST.push(dateStr);
          break;
          default:
            console.log('defaulted');
        }

        //console.log(`${elem.attribs.class}:\t\t${elem.children[0].data}`);
      });
    }
    console.log(fDates);
    return callback(null, fDates);
  });
}

function parseDate(dateString){
  var fullString = '';
  dateArray = dateString.split(" ");
  fullString += dateArray[1] + '-';//day of the month(already padded)
  months = ['januari',
            'februari',
            'maart',
            'april',
            'mei',
            'juni',
            'juli',
            'augustus',
            'september',
            'oktober',
            'november',
            'december'];
  var monthNum = months.indexOf(dateArray[2]) + 1;
  if(monthNum > 0){
    var monthString = (monthNum+1).toString();
    if(monthString.length === 1){
      monthString = '0' + monthString;
    }
    fullString += monthString + '-';
  }else{
    conole.log('This should not be possible...');
    return 'erroneous date';
  }
  fullString += new Date().getFullYear();
  //console.log(fullString);
  return fullString;
}

apiList.push(afvalapp);
apiList.push(mijnAfvalWijzer);

module.exports = apiList;

function BlinkAfvalkalender(postcode, housenumber, country, callback) {
    if (country !== "NL") {
        callback(new Error('unsupported country'));
        return;
    }

    var wasteTypeMap = {
        rest: ["REST"],
        gft: ["GFT"],
        papier: ["PAPIER"],
        kunststof : ["PLASTIC", "PMD"]
    };

    var addressUrl = `https://mijnblink.nl/rest/adressen/${postcode}-${housenumber}/`;

    request(addressUrl, function (err, res) {
        if (!err && res.statusCode == 200) {
            var address = JSON.parse(res.body);
            if(address.length == 1 && 'bagId' in address[0]) {
                var bagId = address[0].bagId;
                var wasteTypesUrl = `https://mijnblink.nl/rest/adressen/${bagId}/afvalstromen`;

                var year = (new Date()).getFullYear();
                // TODO: Maybe fetch next year as well to prevent missing dates for the next calendar year
                var calendarUrl = `https://mijnblink.nl/rest/adressen/${bagId}/kalender/${year}`;

                request(wasteTypesUrl, function (err, res) {
                    if (!err && res.statusCode == 200) {
                        var wasteType = JSON.parse(res.body);
                        if (wasteType.length > 0) {
                            var collection = {};

                            wasteType.forEach(function (type) {
                                if(type.slug in wasteTypeMap) {
                                    wasteTypeMap[type.id] = wasteTypeMap[type.slug];
                                }
                            });

                            request(calendarUrl, function (err, res) {
                                if (!err && res.statusCode == 200) {
                                    var calendar = JSON.parse(res.body);
                                    if (Object.keys(calendar).length > 0) {
                                        Object.keys(calendar).forEach(function(key) {
                                            var day = calendar[key];
                                            if(wasteTypeMap[day.afvalstroom_id]) {
                                                if ('ophaaldatum' in day) {
                                                    var date = day.ophaaldatum.split('-').reverse().join('-');
                                                    wasteTypeMap[day.afvalstroom_id].forEach(function(type) {
                                                        if(!collection[type]) {
                                                            collection[type] = [];
                                                        }
                                                        collection[type].push(date);
                                                    });
                                                }
                                            }
                                        });

                                        return callback(null, collection);
                                    } else {
                                        return callback(new Error('No collection dates returned for location'));
                                    }
                                } else {
                                    return callback(new Error('Could not fetch collection dates for location'));
                                }
                            });
                        } else {
                            return callback(new Error('No waste types returned for location'));
                        }
                    } else {
                        return callback(new Error('Could not fetch waste types for location'));
                    }
                });
            } else {
                return callback(new Error('Invalid location'));
            }
        } else {
            return callback(new Error('Could not fetch location data'));
        }
    });
}
