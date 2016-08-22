//=============================================================================
// Generate a completely random but valid protobuf message.
//
// Input: a parsed protocol buffer object, as generated by grpc.load()
//
// Example usage: 
//  var grpc = require("grpc");
//  var randomProtoGen = require("./randomProtoMessage");
//  var myProtoSpec = grpc.load("myProtoFile.proto");
//  var randomMessage = randomProto(myProtoSpec);
//
//-----------------------------------------------------------------------------

var sorrow = require("sorrow")
var crypto = require("crypto")

//=============================================================================
function randomInt (low, high) 
//
// Random integer between high and low, inclusive.
// 
{
    return Math.floor(Math.random() * (high - low + 1) + low);
};

//=============================================================================
function RandomSingleNumber(field) 
// 
// Return a number composed of random bytes.
// 
{
	var buf = crypto.randomBytes(8);
	var protoNumConvert = {
		"double" : "readDoubleLE",
		"float" : "readFloatLE",
		"int32" : "readInt32LE",
		"int64" : "readInt32LE",   // 64 bit integers are difficult in javascript...
		"uint32" : "readUInt32LE",
		"uint64" : "readUInt32LE",
		"sint32" : "readInt32LE",
		"sint64" : "readInt32LE",  
		"fixed32" : "readUInt32LE",
		"fixed64" : "readUInt32LE",
		"sfixed32" : "readInt32LE",
		"sfixed64" : "readInt32LE"		
	};
	
	var numberType = field.type.name;
	if (!protoNumConvert.hasOwnProperty(numberType)) {
		console.error("Unknown number type!");
		return buf.readDoubleLE();
	}
	
	var func = protoNumConvert[numberType];
	return buf[func]();	
}

//=============================================================================
function RandomBytes()
// 
// Return a random number of random bytes, up to 1MB.
// 
{
	// Maximum recommended grpc message size is 1MB. 
	// Is that 2^20 or 10^6? Dunno.
	var size = randomInt(0, 1048575);
	return crypto.randomBytes(size);	
}

//=============================================================================
function RandomEnum(field) 
// 
// Return a random valid enum value for this field.
// 
{	
	var enums = field.resolvedType.object;
	var size = Object.keys(enums).length;
	
	return randomInt(0, size-1);	
}

//=============================================================================
function RandomRepeatedElement(field)
// 
// Return an array of random values of the correct type for this field.
// 
{
	var anArraySize = sorrow.array.length;	
	var arr = [];
	
	for (var i = 0; i < anArraySize; ++i) {
		arr.push(RandomSingleElement(field));
	}	
	
	return arr;
}

//=============================================================================
function RandomSingleElement(field) 
//
// Return a random value of the correct type for this field.
// If the field is a message, recursively calls RandomProtoMessage()
// 
{
	if (field.type.name == "message") {
		return RandomProtoMessage(field.resolvedType);
	}
	
	if (field.type.name == "enum") {
		return RandomEnum(field);
	}
	
	if (field.type.name == "bytes") {
		return RandomBytes();
	}

	var type = typeof field.type.defaultValue;
	
	if (type == 'number') {
		return RandomSingleNumber(field);
	}
	
	return sorrow[type]
}

//=============================================================================
function RandomField(field) 
//
// field: A field object, i.e. protomessage._fieldsByName[x]
//
// Returns a random value of the correct type for this field.
//
{
	if (field.repeated) {
		return RandomRepeatedElement(field);
	} else {
		return RandomSingleElement(field);
	}
}

//=============================================================================
function ExtractRandomOneOfs(protoMessageType)
// 
// protoMessageType: A protobuf message type object,
//                   in the format produced by grpc.load()
// 
// Returns a random message containing exactly one of each oneof
// needed by the message.
//
{
	var oneOfCollections = {};
	for (var name in protoMessageType._fieldsByName) {
		var field = protoMessageType._fieldsByName[name];
		if (field.oneof) {
			var oneOfName = field.oneof.name;
			if (!oneOfCollections[oneOfName]) {
				oneOfCollections[oneOfName] = [];
			}
			oneOfCollections[oneOfName].push(field)
		}			
	}
	
	var randomMessages = {};
	
	for (var oneOfName in oneOfCollections) {
		if (!oneOfCollections.hasOwnProperty(oneOfName)) { continue; }
		var oneOfArray = oneOfCollections[oneOfName];
		var i = randomInt(0, oneOfArray.length);
		var field = oneOfArray[i];
		randomMessages[field.name] = RandomField(field);
	};
	
	return randomMessages;
}

//=============================================================================
function RandomProtoMessage(protoMessageType)
// 
// protoMessageType: A protobuf message type object,
//                   as found inside an object produced by grpc.load()
// 
// Returns a random message matching the specification of the protobuf message.
// 
{
	var randomMessage = {};
	randomMessage = ExtractRandomOneOfs(protoMessageType);
	
	for (var name in protoMessageType._fieldsByName) {
		var field = protoMessageType._fieldsByName[name];
		
		if (field.oneof) {
			// oneofs have already been handled above
			continue;
		}
		randomMessage[name] = RandomField(field);
	}
	
	return randomMessage;	
}


//=============================================================================
module.exports = function(protoMessageSpec) 
//  
// protoMessageSpec: A protobuf message object,
//                   in the format produced by grpc.load()
// 
// Returns a random message matching the specification of the protobuf message.
//
{
	return RandomProtoMessage(protoMessageSpec.$type);
};