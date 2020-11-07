const colors = ['blue', 'red', 'green', 'purple'];
// initialize map
let map = L.map('mapid', {
    zoomControl: false
}).setView([44.432283, 26.104162], 13);
L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18
}).addTo(map);
L.control.zoom({
    position: 'bottomright'
}).addTo(map);

// add markers on click
map.on('click', function (e) {
    let marker = L.marker(e.latlng).addTo(map);

    getAddress(e.latlng)
        .then(address => addMarkerAddressToAddressList(address, marker));
});

// Reverse geocoding: get address from coordinates
async function getAddress(latlng) {
    let nominatinApiUrl = "http://localhost:7070";

    return await fetch(nominatinApiUrl + "/reverse?lat=" + latlng.lat + "&lon=" + latlng.lng + "&format=jsonv2", {
        method: "GET"
    }).then(response => response.json());
}

async function addMarkerAddressToAddressList(address, marker) {
    const fullAddress = address.display_name;

    let divWithSearchTags = document.getElementsByClassName("divWithSearchTags")[0];
    let interiorDiv = document.getElementsByClassName("interiorDivWithTags")[0];
    if (divWithSearchTags.style.visibility === 'hidden') {
        divWithSearchTags.style.visibility = 'visible';
    }
    let divWithSearchTag = document.getElementsByClassName("tagClass")[0];
    let clone = divWithSearchTag.cloneNode(true);
    interiorDiv.appendChild(clone);
    document.getElementsByClassName("addressP")[i].innerHTML = fullAddress;
    clone.style.display = 'block';
    clone.id = 'clone-' + i;
    i++;

    // Add the address to the marker so we can find it and delete the marker on address delete
    marker.address = fullAddress;
}

async function solveProblemForSelectedMarkers() {
    let markerLocations = [];
    let demands = [];
    let carsWithCapacity = [1000];

    // get coords from all markers from the map
    map.eachLayer(function (layer) {
        if (layer instanceof L.Marker) {
            markerLocations.push([layer.getLatLng().lng, layer.getLatLng().lat]);
        }
    });

    // Generate dummy demands TODO: get the demands from address list
    for (let i = 0; i < markerLocations.length; i++) {
        demands.push(1);
    }

    // call the openrouteservice api to get the distance matrix
    let distanceMatrix = await getDistanceMatrix(markerLocations);

    // add the demands and cars to the response from the distance matrix
    addDemands(distanceMatrix, demands);
    // TODO: get the capacities from the modal built by madalina
    addCars(distanceMatrix, carsWithCapacity);

    // send the distance matrix object to the Flask backend to calculate the routes
    const optimizedSolution = await getSolution(distanceMatrix);

    await showSolutionOnMapForSelectedMarkers(optimizedSolution);
}

async function showSolutionOnMapForSelectedMarkers(optimizedSolution) {
    // delete current markers so we can show the ones with numbers
    deleteAllMarkers();

    let cont = 0;

    for (const route of optimizedSolution.routes) {
        let locationsArray = [];
        let cont2 = 0;
        route.locations.forEach(location => {
            locationsArray.push(location.location)
            if (cont2 === 0) {
                L.marker([
                        location.location[1],
                        location.location[0]
                    ]
                ).addTo(map);
            } else if (route.locations.length > cont2 + 1) {

                let coloredMarkerIcon = L.AwesomeMarkers.icon({
                    icon: '',
                    prefix: 'fa',
                    markerColor: colors[cont],
                    html: cont2
                });
                L.marker([
                        location.location[1],
                        location.location[0]
                    ],
                    {icon: coloredMarkerIcon}
                ).addTo(map);
            }
            cont2++;
        })

        let vehicleRoute = await getDirections(locationsArray);

        let path = L.geoJSON(vehicleRoute);

        path.setStyle({
            color: colors[cont]
        });
        map.addLayer(path);

        cont++;
    }
}

function deleteAllMarkers() {
    map.eachLayer(function (layer) {
        if (layer instanceof L.Marker) {
            layer.remove();
        }
    });
}

async function showSolutionOnMap(optimizedSolution) {
    let cont = 0;

    for (const route of optimizedSolution.routes) {
        let locationsArray = [];
        let cont2 = 0;
        route.locations.forEach(location => {
            locationsArray.push(location.location)
            if (cont2 === 0) {
                L.marker([
                        location.location[1],
                        location.location[0]
                    ]
                ).addTo(map);
            } else if (route.locations.length > cont2 + 1) {

                let coloredMarkerIcon = L.AwesomeMarkers.icon({
                    icon: '',
                    prefix: 'fa',
                    markerColor: colors[cont],
                    html: cont2
                });
                L.marker([
                        location.location[1],
                        location.location[0]
                    ],
                    {icon: coloredMarkerIcon}
                ).addTo(map);
            }
            cont2++;
        })

        let vehicleRoute = await getDirections(locationsArray);

        let path = L.geoJSON(vehicleRoute);

        path.setStyle({
            color: colors[cont]
        });
        map.addLayer(path);

        cont++;
    }
}

async function getDirections(coordinates) {
    let directionsApiUrl = "http://localhost:8080/ors/v2/directions/driving-car/geojson";

    return await fetch(directionsApiUrl, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({coordinates: coordinates})
    }).then(response => response.json());
}

// Solving the problem
async function solveHardCodedProblem() {
    // first address is the depot
    let addresses = [
        "Str. Sinaia 18, bucuresti",
        "Aleea magura vulturului 7",
        "Constantin Budisteanu 20",
        "Aleea Ilioara 3"
    ];
    // the weight (demand) of the package for each address destination (todo: maybe include this in the addresses object)
    // first is the depot so the value is 0
    let demands = [0, 3, 5, 1];
    // we have two cars each having a capacity of 5
    let carsWithCapacity = [5, 5];

    // get the polar coordinates (lat, lng) from the nominatim api
    let nominatimResponses = addresses.map(address => getCoordinates(address));
    const nominatimObjects = await Promise.all(nominatimResponses);

    // extract the lat/lng from each nominatim query response and map them in an object required by the distance matrix
    // e.g {"locations":[[26.1347683,44.4443487],[26.1604182,44.4125858],[26.0901043,44.4433876]]}
    let locations = nominatimObjects
        .flat(1)
        .map(object => [object.lon, object.lat]);

    // call the openrouteservice api to get the distance matrix
    let distanceMatrix = await getDistanceMatrix(locations);

    // add the demands and cars to the response from the distance matrix
    addDemands(distanceMatrix, demands);
    addCars(distanceMatrix, carsWithCapacity);

    // send the distance matrix object to the Flask backend to calculate the routes
    const optimizedSolution = await getSolution(distanceMatrix);

    await showSolutionOnMap(optimizedSolution)
    console.log(optimizedSolution);
}

async function getCoordinates(address) {
    let nominatinApiUrl = "http://localhost:7070";

    return await fetch(nominatinApiUrl + "/search?q=" + address + "&format=jsonv2", {
        method: "POST"
    }).then(response => response.json());
}

async function getDistanceMatrix(locations) {
    let matrixApiUrl = "http://localhost:8080/ors/v2/matrix/driving-car";

    return await fetch(matrixApiUrl, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({locations: locations})
    }).then(response => response.json());
}

function addDemands(distanceMatrix, demands) {
    // add the demands of each location in the response received from the distance matrix api
    // the demands are added in the metadata.query.locations object
    for (let i = 0; i < demands.length; i++) {
        distanceMatrix.metadata.query.locations[i] = {
            location: distanceMatrix.metadata.query.locations[i],
            demand: demands[i]
        };
    }

}

function addCars(distanceMatrix, carsWithCapacity) {
    distanceMatrix.metadata.cars = carsWithCapacity;
}

async function getSolution(distanceMatrix) {
    console.log(distanceMatrix);
    return fetch("http://localhost:5001/api/cvrp", {
        method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(distanceMatrix)
    }).then(response => response.json());
}


// Alina
let i = 1;

function deleteTagAndMarker(el) {
    let elementToBeRemoved = el.parentElement.parentElement.parentElement;
    elementToBeRemoved.remove();
    if (document.getElementsByClassName("tagClass").length === 1) {
        i = 1;
        document.getElementsByClassName("divWithSearchTags")[0].style.visibility = 'hidden';
        document.getElementById("searchId").value = "";
    }

    // Delete marker by address
    map.eachLayer(function (layer) {
        if (layer instanceof L.Marker && elementToBeRemoved.textContent.includes(layer.address)) {
            layer.remove();
        }
    });
}

async function addSearchTagToAddressList() {
    let value = document.getElementById("searchId").value;
    let divWithSearchTags = document.getElementsByClassName("divWithSearchTags")[0];
    let interiorDiv = document.getElementsByClassName("interiorDivWithTags")[0];
    if (divWithSearchTags.style.visibility === 'hidden') {
        divWithSearchTags.style.visibility = 'visible';
    }
    let divWithSearchTag = document.getElementsByClassName("tagClass")[0];
    let clone = divWithSearchTag.cloneNode(true);
    interiorDiv.appendChild(clone);

    const nominatimObject = await getCoordinates(value);
    const fullAddress = nominatimObject[0].display_name;

    document.getElementsByClassName("addressP")[i].innerHTML = fullAddress;
    clone.style.display = 'block';
    clone.id = 'clone-' + i;
    i++;

    // Add marker on map
    let marker = L.marker([
            nominatimObject[0].lat,
            nominatimObject[0].lon
        ]
    ).addTo(map);
    // Add the address to the marker so we can find it and delete the marker on address delete
    marker.address = fullAddress;
}

let input = document.getElementById("searchId");

// Execute a function when the user releases a key on the keyboard
input.addEventListener("keyup", function (event) {
    // Number 13 is the "Enter" key on the keyboard
    if (event.key === 'Enter') {
        // Cancel the default action, if needed
        event.preventDefault();
        // Trigger the adding of the tags
        addSearchTagToAddressList();
    }
});

async function generateRoutes() {
    await solveProblemForSelectedMarkers();
}

// Madalina

function getCarDetails() {
    var elem = document.getElementById('home-btn-id');
    console.log("home modal");
    //elem.style.color = newColor;
}

function menuBtnEvent() {
    let page1 = document.getElementById('page1');
    page1.classList.add("hide");

    let page2 = document.getElementById('page2');
    page2.classList.remove("hide");
}

function backBtnEvent() {
    console.log("fvgrg");
    let page2 = document.getElementById('page2');
    page2.classList.add("hide");

    let page1 = document.getElementById('page1');
    page1.classList.remove("hide");

}

function numberOfCarsEvent(element) {
    if (event.key === 'Enter') {
        console.log("enter");
        console.log(element.value);
        appendCars(element.value);
    }
}

function appendCars(nr) {
    console.log("appendCars");
    let div = document.getElementById("listOfCarsId");
    div.innerHTML = '';

    for (let i = 1; i <= nr; i++) {
        console.log(i);

        ///////////////////////////////////////////////////
        let newDivName = document.createElement('div');
        newDivName.setAttribute("id", "carName" + i);
        newDivName.setAttribute("class", "form-group row");

        let newLabelName = document.createElement("label");
        newLabelName.setAttribute("for", "carNameLabel" + i);
        newLabelName.setAttribute("class", "col-sm-4 col-form-label");
        newLabelName.appendChild(document.createTextNode("Name:"));

        let newDivName2 = document.createElement('div');
        newDivName2.setAttribute("class", "col-sm-5");

        let newInputName = document.createElement('input');
        newInputName.setAttribute("type", "text");
        newInputName.setAttribute("id", "carNameLabel" + i);
        newInputName.setAttribute("class", "form-control");

        newDivName2.appendChild(newInputName);
        newDivName.appendChild(newLabelName);
        newDivName.appendChild(newDivName2);

        ///////////////////////////////////////////////////
        let newDivCapacity = document.createElement('div');
        newDivCapacity.setAttribute("id", "carCapacity" + i);
        newDivCapacity.setAttribute("class", "form-group row");

        let newLabelCapacity = document.createElement("label");
        newLabelCapacity.setAttribute("for", "carCapacityLabel" + i);
        newLabelCapacity.setAttribute("class", "col-sm-4 col-form-label");
        newLabelCapacity.appendChild(document.createTextNode("Capacity:"));

        let newDivCapacity2 = document.createElement('div');
        newDivCapacity2.setAttribute("class", "col-sm-5");

        let newInputCapacity = document.createElement('input');
        newInputCapacity.setAttribute("type", "text");
        newInputCapacity.setAttribute("id", "carCapacityLabel" + i);
        newInputCapacity.setAttribute("class", "form-control");

        newDivCapacity2.appendChild(newInputCapacity);
        newDivCapacity.appendChild(newLabelCapacity);
        newDivCapacity.appendChild(newDivCapacity2);

        div.appendChild(document.createElement("hr"));
        div.appendChild(newDivName);
        div.appendChild(newDivCapacity);
    }

}