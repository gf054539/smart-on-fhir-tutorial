(function(window){
  window.extractData = function() {
    var ret = $.Deferred();
	
    function onError() {
      console.log('Loading error', arguments);
      ret.reject();
    }

	function onUserFail() {
		console.log('User fail', arguments);
		ret.reject();
	}
	
	function onInvalidToken( err ) {
		console.log('Token Validate fail', practitioner);
		ret.reject();
	}
	
	//keySet is the set of valid keys in use.
	//ID Token is a json web token which needs validated against the keySet that's returned.
	function validateKey(keySet, idTokenStr){
		//Decode the token;
		var idToken = JWT.decode(idTokenStr, {complete: true}); 
		var targetKeyId = idToken.header.kid;
		var locatedKey;
		
		keySet.keys.forEach( function( key )  {
			if(key.kid == targetKeyId) {
				locatedKey = key;
			}				
		});
		
		//TODO:  Crap.  Need JWK to PEM
		//TODO:  Remove the expiration setting
		var pem = JWKTOPEM(locatedKey);
		var options = {
			"algorithms" : ["RS256"],
			"ignoreExpiration": true
		};
		try {
			var decoded = JWT.verify( idTokenStr, pem, options );
			console.log(decoded);
		} catch(err) {
			console.log(err);
		}


	}
	
	
    function onReady(smart)  {
	  //Validate Token
	  var idToken = smart.tokenResponse.id_token;
	  var keySet = $.getJSON( "https://cors-anywhere.herokuapp.com/https://authorization.sandboxcerner.com/jwk", function(keySetJson){ 
		validateKey(keySetJson, idToken);
		}
	  );
		
      if (smart.hasOwnProperty('patient')) {
        var patient = smart.patient;
        var pt = patient.read();
		var user = smart.user.read();
		
        var obv = smart.patient.api.fetchAll({
                    type: 'Observation',
                    query: {
                      code: {
                        $or: ['http://loinc.org|8302-2', 'http://loinc.org|8462-4',
                              'http://loinc.org|8480-6', 'http://loinc.org|2085-9',
                              'http://loinc.org|2089-1', 'http://loinc.org|55284-4']
                      }
                    }
                  });

		//var orgs = smart.api.search( {type: 'Organization', query: {id: 'gt1'} } );
        $.when(pt, obv).fail(onError);
		$.when(user).fail(onUserFail);
		

        $.when(pt, obv, user).done(function(patient, obv, user) {
		  console.log(user);
		  console.log(patient);
		  console.log(obv);
		  
          var byCodes = smart.byCodes(obv, 'code');
          var gender = patient.gender;
          var dob = new Date(patient.birthDate);
          var day = dob.getDate();
          var monthIndex = dob.getMonth() + 1;
          var year = dob.getFullYear();

          var dobStr = monthIndex + '/' + day + '/' + year;
          var fname = '';
          var lname = '';

          if (typeof patient.name[0] !== 'undefined') {
            fname = patient.name[0].given.join(' ');
            lname = patient.name[0].family.join(' ');
          }

          var height = byCodes('8302-2');
          var systolicbp = getBloodPressureValue(byCodes('55284-4'),'8480-6');
          var diastolicbp = getBloodPressureValue(byCodes('55284-4'),'8462-4');
          var hdl = byCodes('2085-9');
          var ldl = byCodes('2089-1');

          var p = defaultPatient();
		  
		  p.uid = user.id;
		  p.user = user.user;
		  p.userid = user.name;
		  p.active = user.active;
		  
          p.birthdate = dobStr;
          p.gender = gender;
          p.fname = fname;
          p.lname = lname;
          p.age = parseInt(calculateAge(dob));
          p.height = getQuantityValueAndUnit(height[0]);

          if (typeof systolicbp != 'undefined')  {
            p.systolicbp = systolicbp;
          }

          if (typeof diastolicbp != 'undefined') {
            p.diastolicbp = diastolicbp;
          }

          p.hdl = getQuantityValueAndUnit(hdl[0]);
          p.ldl = getQuantityValueAndUnit(ldl[0]);
          ret.resolve(p);
        });
      } else {
        onError();
      }
    }
	
    FHIR.oauth2.ready(onReady, onError);
    return ret.promise();

  };

  function defaultPatient(){
    return {
      fname: {value: ''},
      lname: {value: ''},
      gender: {value: ''},
      birthdate: {value: ''},
      age: {value: ''},
      height: {value: ''},
      systolicbp: {value: ''},
      diastolicbp: {value: ''},
      ldl: {value: ''},
      hdl: {value: ''},
	  userid: {value: ''},
	  uid: {value: ''},
	  active: {value: ''}
    };
  }

  function getBloodPressureValue(BPObservations, typeOfPressure) {
    var formattedBPObservations = [];
    BPObservations.forEach(function(observation){
      var BP = observation.component.find(function(component){
        return component.code.coding.find(function(coding) {
          return coding.code == typeOfPressure;
        });
      });
      if (BP) {
        observation.valueQuantity = BP.valueQuantity;
        formattedBPObservations.push(observation);
      }
    });

    return getQuantityValueAndUnit(formattedBPObservations[0]);
  }

  function isLeapYear(year) {
    return new Date(year, 1, 29).getMonth() === 1;
  }

  function calculateAge(date) {
    if (Object.prototype.toString.call(date) === '[object Date]' && !isNaN(date.getTime())) {
      var d = new Date(date), now = new Date();
      var years = now.getFullYear() - d.getFullYear();
      d.setFullYear(d.getFullYear() + years);
      if (d > now) {
        years--;
        d.setFullYear(d.getFullYear() - 1);
      }
      var days = (now.getTime() - d.getTime()) / (3600 * 24 * 1000);
      return years + days / (isLeapYear(now.getFullYear()) ? 366 : 365);
    }
    else {
      return undefined;
    }
  }

  function getQuantityValueAndUnit(ob) {
    if (typeof ob != 'undefined' &&
        typeof ob.valueQuantity != 'undefined' &&
        typeof ob.valueQuantity.value != 'undefined' &&
        typeof ob.valueQuantity.unit != 'undefined') {
          return ob.valueQuantity.value + ' ' + ob.valueQuantity.unit;
    } else {
      return undefined;
    }
  }

    
  window.drawVisualization = function(p) {
    $('#holder').show();
    $('#loading').hide();
    $('#fname').html(p.fname);
    $('#lname').html(p.lname);
    $('#gender').html(p.gender);
    $('#birthdate').html(p.birthdate);
    $('#age').html(p.age);
    $('#height').html(p.height);
    $('#systolicbp').html(p.systolicbp);
    $('#diastolicbp').html(p.diastolicbp);
    $('#ldl').html(p.ldl);
    $('#hdl').html(p.hdl);
	$('#userid').html(p.userid);
	$('#uid').html(p.uid);
	$('#active').html(p.active);
  };

})(window);
