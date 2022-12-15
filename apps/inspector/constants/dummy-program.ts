import { Parser } from '@composite/parser';

const parser = new Parser();

export const DUMMY_PROGRAM = parser.parse(`
val text = "something else";

component App() {
  val text = "Bye";
} => (
  <div className={"w-full h-full"}>
   <div className={"bg-orange-100 text-neutral-800 w-full h-full flex flex-col items-center justify-center"}>
    <h2 className={"text-2xl"}>
     <text value={"Welcome to my app"} />
    </h2>
    <p className={"opacity-80 font-light"}>
     <text value={"It's a really cool app"} />
    </p>
    <Button className={"mt-3"} text={"Click me"} />
   </div>
   <div className={"py-4 px-4"}>
    <h2 className={"text-3xl"}>
     <text value={"Posts"} />
    </h2>
    <div className={"mt-2 grid grid-cols-2 gap-4"}>
     <Card @each={post in posts} name={post.name} description={post.description} />
    </div>
   </div>
  </div>
)

component Button(className,text,icon) {
  val counter = 1;
} => (
  <button className={"flex items-center gap-2 px-4 py-2 text-xs cursor-pointer rounded-full bg-black hover:bg-neutral-500 text-white "+className}>
   <span>
    <text value={text} />
   </span>
   <Icon name={icon} @if={icon} />
  </button>
)

component Card(name, description) {
} => (
  <div>
   <img src={"/images/placeholder.jpeg"} />
   <div className={"mt-2"}>
    <h2 className={"text-lg"}>
     <text value={name} />
    </h2>
    <p className={"text-xs opacity-60"}>
     <text value={description} />
    </p>
    <Button className={"mt-2"} text={"Visit page"} icon={"ArrowRightIcon"} />
   </div>
  </div>
)
`);
