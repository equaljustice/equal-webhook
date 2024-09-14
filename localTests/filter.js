const data = [
    {
      "richContent": [
        [
          {
            "text": [
              "Card to card transfer - (Card account debited but the beneficiary card account not credited.)",
              "Point of Sale (PoS)-Account debited but confirmation not received at merchant location i.e., charge-slip not generated..",
              "Card Not Present eg: ecommerce transaction - Account debited but confirmation not received at merchant’s system."
            ],
            "type": "description",
            "title": "Have a look before choosing the option"
          }
        ]
      ]
    },
    {
      "richContent": [
        [
          {
            "type": "chips",
            "options": [
              { "text": "Card to card transfer" },
              { "text": "Point of Sale (PoS)" },
              { "text": "Card Not Present" }
            ]
          }
        ]
      ]
    }
  ];
  
  // Filter function to get the object where type == 'chips'
  const filterChipsType = data.find(item => 
    item.richContent.some(content => 
      content.some(innerContent => innerContent.type === 'chips')
    )
  );
  
  console.log(JSON.stringify(filterChipsType));
  