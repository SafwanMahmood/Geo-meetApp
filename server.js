var WebSocketServer = require('websocket').server;
var http = require('http');
var geolib = require('geolib');

var center = geolib.getCenter([
    {latitude: 52.516272, longitude: 13.377722},
    {latitude: 51.515, longitude: 7.453619},
    {latitude: 51.503333, longitude: -0.119722}
]);

console.log(center)

var googleMapsClient = require('@google/maps').createClient({
  key: 'AIzaSyBr7DVrKhFlYQaFcZi29G2J_u-TUh6HNs4'
});
googleMapsClient.distanceMatrix({
				origins: ['17.594703,78.123105'],
				destinations: ['17.528743,78.266725'],
				mode: 'driving'
			},function(err, response) {
			  if (!err) {
			    console.log(response.json.rows[0]['elements'][0]['duration']['value']);
			  } else{
			  	console.log("error",err);
			  }});

// var publicConfig = {
//   key: 'AIzaSyBil0AHMoPSe3nj0IEr-92ezrDHejb__6A',
//   encode_polylines:   false,
//   secure:             true, // use https ,
// };
// var gmAPI = new GoogleMapsAPI(publicConfig);

var locations = [
                ['IIT Hyderabad', 17.594703, 78.123105, 928147],
                ['patencheru', 17.528743, 78.266725, 921147],
                ['sangareddy', 17.619416, 78.082308, 928197],
                ['gachibowli', 17.440080, 78.348917, 928347],
                ['Shankarpally', 17.455365, 78.131167, 9212317]
];

// var marker, i;

console.log(googleMapsClient);


var createGroup = 'Header:CG';
var joinGroup = 'Header:JG';

var groups = {};
var groups_time = {};
var groupSize = {};
var groupConnections = {};
var groups_place_type = {};

var groupID = 1;

var server = http.createServer(function(request, response) {
  // process HTTP request. Since we're writing just WebSockets
  // server we don't have to implement anything.
});
server.listen(1234, function() { });

// create the server
wsServer = new WebSocketServer({
  httpServer: server
});

function getCenter(locationArray){
	return geolib.getCenter(locationArray);
}

function getCurrentDate(){
	var today = new Date();
	var dd = today.getDate();
	var mm = today.getMonth()+1; //January is 0!

	var yyyy = today.getFullYear();
	if(dd<10){
	    dd='0'+dd;
	} 
	if(mm<10){
	    mm='0'+mm;
	} 
	var today = dd+'/'+mm+'/'+yyyy;
	return today;
}

function distanceMatrixApiForDepartureTime(CurrentOriginID, destination, groupID,meetingTime, timesArray,maxTimeKey,mapping_destination_location_to_object){
	var request = {
		origins: [groups[groupID][CurrentOriginID].latitude+','+groups[groupID][CurrentOriginID].longitude],
		destinations: [destination],
		arrival_time: Math.floor((new Date(getCurrentDate).getTime())/1000)+meetingTime,
		mode: 'driving'
	};
	googleMapsClient.distanceMatrix(request,function(err, response) {
	  console.log(CurrentOriginID, destination, groupID,meetingTime, timesArray,maxTimeKey);
	  if (!err) {
	  	timesArray.push(response.json.rows[0].elements[0].duration.value);
	  	var errorMessage = null;
	    if (CurrentOriginID == (groups[groupID].length-1)){
	    	for(var i = 0;i<groupConnections[groupID].length;i++){
				groupConnections[groupID][i].sendUTF(JSON.stringify({type: "LC",message:mapping_destination_location_to_object[maxTimeKey], error:errorMessage, meeting_time:meetingTime+900 ,actual_depart_time:meetingTime-timesArray[i]}));
			}
	    } else{
	    	distanceMatrixApiForDepartureTime(CurrentOriginID+1, destination,groupID, meetingTime, timesArray, maxTimeKey,mapping_destination_location_to_object)
	    }
	  }
	  else{
	  	for(var i = 0;i<groupConnections[groupID].length;i++){
			groupConnections[groupID][i].sendUTF(JSON.stringify({type: "LC",message:null,error:"Couldn't find distance between some points"}));
		}
	  	console.log("some problem occured",err);
	  }});
}

function getLocationWithLeastMaxTime(groupID,mapping_destination_location_to_maxTime, mapping_destination_location_to_object){
	currentMaxTime = 78458734658437;
	maxTimeKey = -1;
	var keys = Object.keys(mapping_destination_location_to_maxTime);
	console.log("easadaksjdf");
	console.log(keys)
	console.log(mapping_destination_location_to_maxTime);
	for(var i = 0;i<Object.keys(mapping_destination_location_to_maxTime).length;i++){
		if(mapping_destination_location_to_maxTime[keys[i]]<currentMaxTime){
			currentMaxTime = mapping_destination_location_to_maxTime[keys[i]];
			maxTimeKey = keys[i];
			console.log("min:",currentMaxTime);
		}
	}
	var meetingTime = -1;
	for (var i = 0; i < groups_time[groupID].length; i++) {
		meetingTime = Math.max(groups_time[groupID][i]+currentMaxTime,meetingTime);
	}
	console.log("problem?",groupConnections[groupID].length);
	distanceMatrixApiForDepartureTime(0,mapping_destination_location_to_object[maxTimeKey]['geometry']['location'].lat+','+mapping_destination_location_to_object[maxTimeKey]['geometry']['location'].lng,groupID,meetingTime,[],maxTimeKey, mapping_destination_location_to_object);
}

function getBestMeetingPoint(results, groupID,mapping_destination_location_to_maxTime,mapping_destination_location_to_object, groupID_index, location_to_object_index){
	console.log(groupID_index, groups[groupID].length,  location_to_object_index, Object.keys(mapping_destination_location_to_object).length);
	var i= groupID_index;
	var j= location_to_object_index;
	var location = groups[groupID][i];
	var locationArray = [location.latitude+','+location.longitude];
	var keys = Object.keys(mapping_destination_location_to_object);
	var request = {
		origins: locationArray,
		destinations: [keys[j]],
		mode: 'driving'
	};
	googleMapsClient.distanceMatrix(request,function(err, response) {
	  if (!err) {
	  	console.log(request);
	  	console.log(response.json.rows[0]['elements']);
	  	if(mapping_destination_location_to_maxTime.hasOwnProperty(request.destinations[0])){
	  		mapping_destination_location_to_maxTime[request.destinations[0]] = Math.max(response.json.rows[0]['elements'][0]['duration']['value'],
	    	mapping_destination_location_to_maxTime[request.destinations[0]]);
	  	} else{
	  		mapping_destination_location_to_maxTime[request.destinations[0]] = response.json.rows[0]['elements'][0]['duration']['value'];
	  	}
	    if ((groupID_index == (groups[groupID].length-1)) && (location_to_object_index == (Object.keys(mapping_destination_location_to_object).length-1))){
	    	console.log(Object.keys(mapping_destination_location_to_maxTime));
	    	console.log(mapping_destination_location_to_maxTime);
	    	console.log(groupID);
	    	getLocationWithLeastMaxTime(groupID, mapping_destination_location_to_maxTime, mapping_destination_location_to_object);
	    } else{
	    	console.log('product',Object.keys(mapping_destination_location_to_object).length*groups[groupID].length,(groupID_index == groups[groupID].length-1),(location_to_object_index == Object.keys(mapping_destination_location_to_object).length-1),(i == groups[groupID].length-1) && (j == Object.keys(mapping_destination_location_to_object).length-1));
	    	if(j == Object.keys(mapping_destination_location_to_object).length-1)
	    		if((i != groups[groupID].length-1))
	    			{
	    				groupID_index+=1;
	    				console.log("called with: ",groupID, groupID_index,0);
	    				getBestMeetingPoint(results,  groupID, mapping_destination_location_to_maxTime,mapping_destination_location_to_object, groupID_index, 0);
	    			}
	    		else{
	    			console.log("enter?");
	    			getLocationWithLeastMaxTime(groupID, mapping_destination_location_to_maxTime, mapping_destination_location_to_object);
	    		}
	    	else{
	    		location_to_object_index+=1;
	    		console.log("called with: ",groupID, groupID_index,location_to_object_index);
	    		getBestMeetingPoint(results,  groupID, mapping_destination_location_to_maxTime, mapping_destination_location_to_object, groupID_index, location_to_object_index);
	    	}
	    }
	  }
	  else{
	  	for(var i = 0;i<groupConnections[groupID].length;i++){
			groupConnections[groupID][i].sendUTF(JSON.stringify({type: "LC",error:"Couldn't find distance between some points"}));
		}
	  	console.log("some problem occured",err);
	  }});

}

function fillMaxIndexArray(results, groupID) {
	var destinationArray = [];
	var mapping_destination_location_to_object = {};
	for (var i = 0; i < results.length; i++) {
		console.log(results[i].geometry['location'].lat,results[i].geometry['location'].lng);
		var location = [results[i].geometry['location'].lat,results[i].geometry['location'].lng];
		mapping_destination_location_to_object[location] = results[i];
	}
	var groupID_index = 0;
	var location_to_object_index = 0;
	var mapping_destination_location_to_maxTime = {};
	getBestMeetingPoint(results, groupID, mapping_destination_location_to_maxTime, mapping_destination_location_to_object, groupID_index, location_to_object_index);
}

function getBestLocation(groupID) {
	var center = getCenter(groups[groupID]);
	console.log([parseFloat(center.latitude),parseFloat(center.longitude)]);
	results = null;
	console.log("check here:",groups_place_type[groupID],groupID);
	googleMapsClient.placesNearby({
      language: 'en',
      location: [parseFloat(center.latitude),parseFloat(center.longitude)],
      radius: 5000,
      opennow: true,
      type: groups_place_type[groupID],
    },  function(err, response) {
	  if (!err) {
	  	console.log("enter?");
	    results = response.json.results;
	    if(results.length == 0){
	    	var errorMessage ="No results found";
	    	for(var i = 0;i<groupConnections[groupID].length;i++){
				groupConnections[groupID][i].sendUTF(JSON.stringify({type: "LC", error:errorMessage}));
			}
			return;
	    }
	    if(results.length>5)
	    	results = results.slice(0,5);
	    console.log(results);
	    fillMaxIndexArray(results, groupID);
	  }
	  else{
	  	for(var i = 0;i<groupConnections[groupID].length;i++){
			groupConnections[groupID][i].sendUTF(JSON.stringify({type: "LC", error:"Some error occured please try again."}));
		}
	  	console.log("error",err);
	  }
	});
}

// WebSocket server
wsServer.on('request', function(request) {
  var connection = request.accept(null, request.origin);

  // This is the most important callback for us, we'll handle
  // all messages from users here.
  connection.on('message', function(message) {
    if (message.type === 'utf8') {
      // process WebSocket message
      if(message.utf8Data.substr(0,9) == createGroup){
      	var obj = JSON.parse(message.utf8Data.substr(10));
      	groups[groupID] = [{latitude:obj.lat, longitude:obj.lng}];
      	groupSize[groupID] = parseInt(obj.groupSize);
      	var depat_time = obj.time;
      	var depat_time_array = depat_time.split(":");
      	var depat_time_seconds = (+depat_time_array[0]) * 60 * 60 + (+depat_time_array[1]) * 60;
      	groups_time[groupID] =  [depat_time_seconds];
      	groups_place_type[groupID] = obj.place;
      	groupID+=1;
      	groupConnections[groupID-1] = []
      	groupConnections[groupID-1].push(connection);
      	connection.sendUTF(JSON.stringify({ type: 'groupID', data: groupID-1, groupsize:obj.groupSize,lat:obj.lat, lng:obj.lng,  time:obj.time, place:obj.place} ));
      	console.log("Created Group ID:"+(groupID-1));
      }
      else if(message.utf8Data.substr(0,9) == joinGroup){
      	var obj = JSON.parse(message.utf8Data.substr(10));
      	var localGroupID = obj.groupID;
      	var lat = obj.lat;
      	var lng = obj.lng;
      	var depat_time = obj.time;
      	var depat_time_array = depat_time.split(":");
      	var depat_time_seconds = (+depat_time_array[0]) * 60 * 60 + (+depat_time_array[1]) * 60;
      	var errorMessage = null;
      	console.log(localGroupID);
      	console.log(Object.keys(groups));
      	if(groups.hasOwnProperty(localGroupID.toString())){
      		if(groupSize[localGroupID] == groups[localGroupID].length){
      			errorMessage = "group already full";
      			console.log("ERROR while joining group ", errorMessage);
      		} else{
      			groups[localGroupID].push({latitude:lat,longitude:lng});
      			groups_time[localGroupID].push(depat_time_seconds);
      			groupConnections[localGroupID].push(connection);
      			if(groupSize[localGroupID] == groups[localGroupID].length){
      				getBestLocation(localGroupID);
      				console.log("entered get best location");
      			}
      			console.log("successfully joined group ");
      		}
      	} 
      	else{
      		errorMessage = "Group ID "+localGroupID+" not yet created";
      		console.log("ERROR while joining group ", errorMessage);
      	}
      	connection.sendUTF(JSON.stringify({ type: 'JG', groupID: localGroupID,lat:obj.lat, lng:obj.lng,error:errorMessage,time:obj.time} ));
      }

    }
  });

  connection.on('close', function(connection) {
    // close user connection

  });
});