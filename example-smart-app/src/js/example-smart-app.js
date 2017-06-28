(function(window){
  window.extractData = function() {
    var ret = $.Deferred();
	    
	function onError() {
      console.log('Loading error', arguments);
      ret.reject();
    }

 	function onInvalidToken( err ) {
		$('#error').html("<h1>Invalid Token!<h1>");
		$('#error').show();
		console.log('Token Validate fail', err);
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
		
		var pem = JWKTOPEM(locatedKey);
		var options = {
			"algorithms" : ["RS256"]
		};
		try {
			var decoded = JWT.verify( idTokenStr, pem, options );
			console.log(decoded);
		} catch(err) {
			onInvalidToken(err);
		}
        if( decodeURIComponent(idToken.payload.iss) == "https://fhir-ehr.sandboxcerner.com/dstu2/0b8a0111-e8e6-4c26-a91c-5069cbc6b1ca" ) {
            var loginInfo = defaultInfo();
            loginInfo.sub = idToken.payload.sub;
            loginInfo.iss = idToken.payload.iss;
            loginInfo.exp = idToken.payload.exp;
            loginInfo.iat = idToken.payload.iat;
            return loginInfo;
        } else {
            onInvalidToken( {message: "invalid token" } );
        }
	}
	
    function onReady(smart)  {
	  //Validate Token
	  var idToken = smart.tokenResponse.id_token;
	  //TODO:  Remove cors-anywhere
	  var keySet = $.getJSON( "https://cors-anywhere.herokuapp.com/https://authorization.sandboxcerner.com/jwk", function(keySetJson){ 
		var info = validateKey(keySetJson, idToken);
		ret.resolve(info);
	  });
    }
	
    FHIR.oauth2.ready(onReady, onError);
    return ret.promise();

  };

  function defaultInfo(){
    return {
      sub: {value: ''},
      iss: {value: ''},
      exp: {value: ''},
      iat: {value: ''}
	};
  }

  window.showLoginInfo = function(info) {
    $('#holder').show();
    $('#loading').hide();
    $('#sub').html(info.sub);
    $('#iss').html(info.iss);
    $('#exp').html(info.exp);
    $('#iat').html(info.iat);
  };

})(window);
