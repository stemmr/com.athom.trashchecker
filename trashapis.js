var apiList = [];
var http = require('http');
var request = require('request');
var cheerio = require('cheerio');

function afvalapp(postcode, homenumber, country, callback) {
    var options = {
        host: 'dataservice.deafvalapp.nl',
        path: '/dataservice/DataServiceServlet?type=ANDROID&service=OPHAALSCHEMA&land=' +
        country + '&postcode=' + postcode + '&straatId=0&huisnr=' + homenumber + '&huisnrtoev='
    };

    var req = http.get(options, (res) => {
        var dates = {};
        var curr = '';
        var data = '';

        res.on('data', function (chunk) {
            data += chunk;
        });

        res.on('end', () => {
            var respArray = data.toString().split('\n').join('').split(";");
            respArray.pop();
            for (var i in respArray) {
                if (isNaN(parseInt(respArray[i]))) {
                    dates[respArray[i]] = [];
                    curr = respArray[i];
                }
                else {
                    dates[curr].push(respArray[i]);
                }
            }

            if (Object.keys(dates).length === 0 && dates.constructor === Object) {
                Homey.log('Invalid input');
                return callback(null, {});
            } else {//validate the response
                return callback(null, dates);
            }
        });
    });

    req.on('error', function (err) {
        Homey.log(err.message);
    });
}

function mijnAfvalWijzer(postcode, housenumber, country, callback) {
    var fDates = {};
    if (country !== "NL") {
        callback(new Error('unsupported country'));
    }

    request(`http://www.mijnafvalwijzer.nl/nl/${postcode}/${housenumber}/`, function (err, res, body) {
        if (!err && res.statusCode == 200) {
            var $ = cheerio.load(res.body);

            $('a.wasteInfoIcon p').each((i, elem) => {
                var dateStr = parseDate(elem.children[0].data);
                //console.log(elem.attribs.class);
                switch (elem.attribs.class) {
                    case 'gft':
                        if (!fDates.GFT) fDates.GFT = [];
                        fDates.GFT.push(dateStr);
                        break;
                    case 'papier':
                        if (!fDates.PAPIER) fDates.PAPIER = [];
                        fDates.PAPIER.push(dateStr);
                        break;
                    case 'restafval':
                        if (!fDates.REST) fDates.REST = [];
                        fDates.REST.push(dateStr);
                        break;
                    case 'restgft':
                        if (!fDates.REST) fDates.REST = [];
                        if (!fDates.GFT) fDates.GFT = [];
                        fDates.REST.push(dateStr);
                        fDates.GFT.push(dateStr);
                        break;
                    case 'dhm':
                        if (!fDates.PAPIER) fDates.PAPIER = [];
                        if (!fDates.PMD) fDates.PMD = [];
                        fDates.PAPIER.push(dateStr);
                        fDates.PMD.push(dateStr);
                        break;
                    default:
                        console.log('defaulted', elem.attribs.class);
                }
            });
            console.log(fDates);
            return callback(null, fDates);
        } else {
            return callback(new Error('Invalid location'));
        }
    });
}

function afvalwijzerArnhem(postcode, housenumber, country, callback) {
    var fDates = {};
    if (country !== "NL") {
        callback(new Error('unsupported country'));
    }

    var url = `http://www.afvalwijzer-arnhem.nl/applicatie?ZipCode=${postcode}&HouseNumber=${housenumber}&HouseNumberAddition=`;
    // console.log(url);

    request(url, function (err, res, body) {
        if (!err && res.statusCode == 200) {
            var $ = cheerio.load(res.body);
            $('ul.ulPickupDates li').each((i, elem) => {
                var dateStr = dateFormat(elem.children[2].data.trim());
                switch (elem.attribs.class) {
                    case 'gft':
                        if (!fDates.GFT) fDates.GFT = [];
                        fDates.GFT.push(dateStr);
                        break;
                    case 'papier':
                        if (!fDates.PAPIER) fDates.PAPIER = [];
                        fDates.PAPIER.push(dateStr);
                        break;
                    case 'restafval':
                        if (!fDates.REST) fDates.REST = [];
                        fDates.REST.push(dateStr);
                        break;
                    case 'kunststof':
                        if (!fDates.PLASTIC) fDates.PLASTIC = [];
                        fDates.PLASTIC.push(dateStr);
                        break;
                    default:
                        console.log('defaulted', elem.attribs.class);
                }
            });
            return callback(null, fDates);
        } else {
            return callback(new Error('Invalid location'));
        }
    })
}

function dateFormat(date) {
    var ad = date.split('-');
    var result = ('0' + ad[0]).slice(-2) + '-' + ('0' + ad[1]).slice(-2) + '-' + ad[2];
    console.log(result);

    // add leading zero if required
    return result;
}

function parseDate(dateString) {
    var dateArray = dateString.split(" ");
    var fullString = dateArray[1] + '-'; //day of the month(already padded)
    var months = [
        'januari',
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
        'december',
    ];
    var monthNum = months.indexOf(dateArray[2]) + 1;
    if (monthNum > 0) {
        var monthString = (monthNum).toString();
        if (monthString.length === 1) {
            monthString = '0' + monthString;
        }
        fullString += monthString + '-';
    } else {
        console.log('This should not be possible...');
        return 'erroneous date';
    }
    fullString += new Date().getFullYear();
    return fullString;
}

apiList.push(afvalapp);
apiList.push(mijnAfvalWijzer);
apiList.push(afvalwijzerArnhem);

module.exports = apiList;
