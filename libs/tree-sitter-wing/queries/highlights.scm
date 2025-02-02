; Variables

((nested_identifier) @variable)
((nested_identifier property: (identifier) @property) . ) 


; Classes

(custom_type) @type
(class_field 
  name: (identifier) @member
) 
(class_definition 
  name: (identifier) @type
)
(method_definition
  name: (identifier) @function
)
(inflight_method_definition
  name: (identifier) @function
)

; Functions

(keyword_argument_key) @variable.parameter
(call 
  caller: (identifier) @function.method
)
(call 
  caller: (nested_identifier) @function.method
)

; Primitives

[
 (number)
 (duration)
] @constant.builtin
(string) @string
(bool) @constant.builtin
(builtin_type) @type.builtin
(json_container_type) @type.builtin

; Special

(comment) @comment

[
  "("
  ")"
  "{"
  "}"
]  @punctuation.bracket

[
  "-"
  "+"
  "*"
  "/"
  "%"
  "<"
  "<="
  "="
  "=="
  "!"
  "!="
  ">"
  ">="
  "&&"
  "??"
  "||"
] @operator

[
  ";"
  "."
  ","
] @punctuation.delimiter

[
  "as"
  "bring"
  "class"
  "else"
  "for"
  "if"
  "in"
  "init"
  "inflight"
  "let"
  "new"
  "return"
] @keyword