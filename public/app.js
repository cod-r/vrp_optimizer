const colors = ['blue', 'red', 'green', 'purple'];
let depotLocation = 'Aleea Fizicienilor 2B';
document.getElementById("depotLocationId").value = depotLocation;

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

// add depot marker
let depotMarkerHomeIcon = L.AwesomeMarkers.icon({
    icon: 'fa-home',
    prefix: 'fa',
    markerColor: 'cadetblue',
});
let depotMarker = L.marker([44.4124659, 26.15551082786226],
    {icon: depotMarkerHomeIcon,}
).addTo(map);
depotMarker.depot = true;
depotMarker.bindPopup('Main Depot');


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
    let carsWithCapacity = [];

    // add the depot marker first
    map.eachLayer(function (layer) {
        if (layer instanceof L.Marker && layer.depot) {
            markerLocations.push([layer.getLatLng().lng, layer.getLatLng().lat]);
            console.log(layer.getLatLng())
        }
    });

    // push the weight of the depot last one
    demands.push(0);

    // get coords from all markers from the map
    map.eachLayer(function (layer) {
        if (layer instanceof L.Marker && !layer.depot) {
            markerLocations.push([layer.getLatLng().lng, layer.getLatLng().lat]);
        }
    });


    let divsWithTags = document.getElementsByClassName("tagClass");
    //get the demands from address list
    for (let i = 1; i < divsWithTags.length; i++) {
        let weightInput = divsWithTags[i].childNodes[1].childNodes[3].childNodes[3];
        demands.push(parseInt(weightInput.value));
    }

    // // call the openrouteservice api to get the distance matrix
    let distanceMatrix = await getDistanceMatrix(markerLocations);
    //
    // // add the demands and cars to the response from the distance matrix
    addDemands(distanceMatrix, demands);

    //get the capacities from the cars modal built by madalina
    let numberOfCars = parseInt(document.getElementById("numberOfCarsId").value);
    for (let i = 1; i <= numberOfCars; i++) {
        carsWithCapacity.push(parseInt(document.getElementById("carCapacityLabel" + i).value))
    }
    addCars(distanceMatrix, carsWithCapacity);
    console.log("distanceMatrix");
    console.log(distanceMatrix);
    // // send the distance matrix object to the Flask backend to calculate the routes
    const optimizedSolution = await getSolution(distanceMatrix);
    await showSolutionOnMapForSelectedMarkers(optimizedSolution);
}

async function showSolutionOnMapForSelectedMarkers(optimizedSolution) {
    console.log("optimizedSolution");
    console.log(optimizedSolution);

    // delete current markers so we can show the ones with numbers
    // deleteAllMarkers();

    let routesCont = 0;

    for (const route of optimizedSolution.routes) {
        let locationsArray = [];
        let cont2 = 0;
        route.locations.forEach(location => {
            locationsArray.push(location.location)
            if (cont2 === 0) {

            } else if (route.locations.length > cont2 + 1) {

                let coloredMarkerIcon = L.AwesomeMarkers.icon({
                    icon: '',
                    prefix: 'fa',
                    markerColor: colors[routesCont],
                    html: cont2
                });
                let mark = L.marker([
                        location.location[1],
                        location.location[0]
                    ],
                    {icon: coloredMarkerIcon}
                );
                mark.bindPopup('Weight: ' + location.demand);

                // map.eachLayer(function (layer) {
                //
                //     if (layer instanceof L.Marker ) {
                //         console.log(layer.getLatLng());
                //         console.log(mark.getLatLng())
                //         // layer.remove();
                //     }
                // });
                mark.addTo(map);
            }
            cont2++;
        })

        let vehicleRoute = await getDirections(locationsArray);

        let path = L.geoJSON(vehicleRoute);

        path.setStyle({
            color: colors[routesCont]
        });
        path.on('mouseover', function (e) {
            path.bindPopup(parseInt(document.getElementById("carCapacityLabel" + routesCont).value));
        });
        map.addLayer(path);

        routesCont++;
    }
}

function deleteAllMarkers() {
    map.eachLayer(function (layer) {
        if (layer instanceof L.Marker && !layer.depot) {
            layer.remove();
        }
    });
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
}

async function saveDepotAddress() {
    depotLocation = document.getElementById("depotLocationId").value;

    const depotCoords = await getCoordinates(depotLocation);
    depotMarker.setLatLng([depotCoords[0].lat, depotCoords[0].lon]);

}

function menuBtnEvent() {
    let page1 = document.getElementById('page1');
    page1.classList.add("hide");
    let searchTags = document.getElementById('searchTags');
    searchTags.classList.add("hide");

    let page2 = document.getElementById('page2');
    page2.classList.remove("hide");
}

function backBtnEvent() {
    let page2 = document.getElementById('page2');
    page2.classList.add("hide");

    let page1 = document.getElementById('page1');
    page1.classList.remove("hide");
    let searchTags = document.getElementById('searchTags');
    searchTags.classList.remove("hide");

}

function numberOfCarsEvent(element) {
    if (event.key === 'Enter') {
        appendCars(element.value);
    }
}

function appendCars(nr) {
    let div = document.getElementById("listOfCarsId");
    div.innerHTML = '';

    for (let i = 1; i <= nr; i++) {

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