var apiList = [];
var http = require('http');

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

  return callback(null, dates);
}

apiList.push(afvalapp);
apiList.push(mijnAfvalWijzer);

module.exports = apiList;
